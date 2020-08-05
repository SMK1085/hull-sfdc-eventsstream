import IHullClient from "../types/hull-client";
import { AwilixContainer, asValue, asClass } from "awilix";
import { PrivateSettings } from "./connector";
import IHullUserUpdateMessage from "../types/user-update-message";
import IHullAccountUpdateMessage from "../types/account-update-message";
import { ConnectorStatusResponse } from "../types/connector-status";
import asyncForEach from "../utils/async-foreach";
import IHullUserEvent from "../types/user-event";
import { ConnectorRedisClient } from "../utils/redis-client";
import { Logger } from "winston";
import {
  get,
  filter,
  endsWith,
  forEach,
  isNil,
  compact,
  uniq,
  forIn,
  set,
  cloneDeep,
  result,
} from "lodash";
import {
  NforceConnectionOptions,
  OutgoingOperationEnvelope,
  HullSfdcPlatformEvent,
  HullSfdcPlatformEventWrapper,
  NforceListMetaRequest,
  NforceListMetaResponseObject,
} from "./service-objects";
import { ServiceClient } from "./service-client";
import { AuthStatus } from "../types/auth-status";
import { FilterUtil } from "../utils/filter-util";
import { LoggingUtil } from "../utils/logging-util";
import { CachingUtil } from "../utils/caching-util";
import { MappingUtil } from "../utils/mapping-util";
import {
  ERROR_UNHANDLED_GENERIC,
  VALIDATION_SETUPREQUIRED_CONNECTEDAPP,
  VALIDATION_SETUPREQUIRED_INITIALAUTH,
} from "./messages";

export class SyncAgent {
  readonly diContainer: AwilixContainer;

  constructor(container: AwilixContainer) {
    this.diContainer = container;
    const privateSettings = get(
      container.resolve("hullConnectorMeta"),
      "private_settings",
    ) as PrivateSettings;
    // Register convenience options for DI
    this.diContainer.register("connectorSettings", asValue(privateSettings));
    // Compose the nforce connection options
    const nforceOptions: NforceConnectionOptions = {
      apiVersion: privateSettings.sfdc_api_version,
      clientId: privateSettings.sfdc_client_id || "none",
      clientSecret: privateSettings.sfdc_client_secret || "none",
      environment: privateSettings.sfdc_environment,
      mode: "multi",
      redirectUri: container.resolve<string>("nforceRedirectUrl"),
      autoRefresh: true,
    };
    this.diContainer.register("nforceOptions", asValue(nforceOptions));
    this.diContainer.register("serviceClient", asClass(ServiceClient).scoped());
    this.diContainer.register("filterUtil", asClass(FilterUtil).scoped());
    this.diContainer.register("mappingUtil", asClass(MappingUtil).scoped());
    this.diContainer.register("loggingUtil", asClass(LoggingUtil).scoped());
    this.diContainer.register("cachingUtil", asClass(CachingUtil).scoped());
  }

  /**
   * Processes outgoing notifications for user:update lane.
   *
   * @param {IHullUserUpdateMessage[]} messages The notification messages.
   * @param {boolean} [isBatch=false] `True` if it is a batch; otherwise `false`.
   * @returns {Promise<void>} An awaitable Promise.
   * @memberof SyncAgent
   */
  public async sendUserMessages(
    messages: IHullUserUpdateMessage[],
    isBatch: boolean = false,
  ): Promise<void> {
    const logger = this.diContainer.resolve<Logger>("logger");
    const loggingUtil = this.diContainer.resolve<LoggingUtil>("loggingUtil");
    const correlationKey = this.diContainer.resolve<string>("correlationKey");

    try {
      const connectorId = this.diContainer.resolve<string>("hullAppId");

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_SENDUSERMESSAGES_START",
          correlationKey,
        ),
      );

      if (isBatch === true) {
        logger.warn(
          loggingUtil.composeOperationalMessage(
            "OPERATION_SENDUSERMESSAGES_BATCHNOTSUPPORTED",
            correlationKey,
          ),
        );
        return;
      }

      const authStatus = await this.determineAuthStatus();

      if (authStatus.statusCode !== 200) {
        logger.debug(
          loggingUtil.composeOperationalMessage(
            "OPERATION_SENDUSERMESSAGES_INVALIDCONFIG",
            correlationKey,
          ),
        );
        return;
      }

      const filterUtil = this.diContainer.resolve<FilterUtil>("filterUtil");
      const filteredEnvelopes = filterUtil.filterUserMessagesInitial(messages);
      const hullClient = this.diContainer.resolve<IHullClient>("hullClient");

      forEach(
        filteredEnvelopes.skips,
        (
          envelope: OutgoingOperationEnvelope<
            IHullUserUpdateMessage,
            HullSfdcPlatformEvent
          >,
        ) => {
          hullClient
            .asUser(envelope.message.user)
            .logger.info("outgoing.user.skip", {
              reason: envelope.notes
                ? envelope.notes.join(" ").trim()
                : "Unknown",
            });
        },
      );

      if (filteredEnvelopes.inserts.length === 0) {
        logger.info(
          loggingUtil.composeOperationalMessage(
            "OPERATION_SENDUSERMESSAGES_NOOP",
            correlationKey,
          ),
        );
        return;
      }

      const connectorSettings = this.diContainer.resolve<PrivateSettings>(
        "connectorSettings",
      );
      const cachingUtil = this.diContainer.resolve<CachingUtil>("cachingUtil");

      const allHullEvents = compact(
        connectorSettings.event_mappings.map((m) => m.hull),
      );
      const uniqueHullEvents = uniq(allHullEvents);
      const finalEnvelopes: OutgoingOperationEnvelope<
        IHullUserUpdateMessage,
        HullSfdcPlatformEventWrapper
      >[] = [];

      let previousToken = cloneDeep(connectorSettings.access_token);
      const oauth = {
        refresh_token: connectorSettings.refresh_token as string,
        access_token: connectorSettings.access_token as string,
        instance_url: connectorSettings.sfdc_instance_url as string,
        issued_at: connectorSettings.issued_at as number,
        id: connectorSettings.sfdc_auth_id as string,
        signature: connectorSettings.sfdc_signature as string,
        scope: connectorSettings.sfdc_scope as string,
      };

      const serviceClient = this.diContainer.resolve<ServiceClient>(
        "serviceClient",
      );
      const mappingUtil = this.diContainer.resolve<MappingUtil>("mappingUtil");

      await asyncForEach(
        filteredEnvelopes.inserts,
        async (
          envelope: OutgoingOperationEnvelope<
            IHullUserUpdateMessage,
            HullSfdcPlatformEvent
          >,
        ) => {
          if (envelope.message.events.length !== 0) {
            const filteredEventsMsg = filter(envelope.message.events, (evt) => {
              return uniqueHullEvents.includes(evt.event);
            });

            await asyncForEach(
              filteredEventsMsg,
              async (evt: IHullUserEvent) => {
                const evtNameMapping = connectorSettings.event_mappings.find(
                  (e) => {
                    return e.hull === evt.event;
                  },
                );

                if (
                  !evtNameMapping ||
                  (!isNil(evtNameMapping) &&
                    (isNil(evtNameMapping.hull) ||
                      isNil(evtNameMapping.service)))
                ) {
                  const logPayload = loggingUtil.composeOperationalMessage(
                    "OPERATION_SENDUSERMESSAGES_NOVALIDMAPPING",
                    correlationKey,
                    `No valid mapping found for Hull event '${evt.event}'. Skipping processing.`,
                  );
                  logger.debug(logPayload);
                } else {
                  const sfdcObjectResponse = await cachingUtil.getCachedApiResponse(
                    `${connectorId}__${evtNameMapping.service}`,
                    () =>
                      serviceClient.describeCustomObject({
                        oauth,
                        type: evtNameMapping.service,
                      }),
                    5 * 60,
                  );

                  if (sfdcObjectResponse.success && sfdcObjectResponse.data) {
                    const sfdcObjectFields = sfdcObjectResponse.data.fields;
                    const finalEnvelope = mappingUtil.mapHullEventToSfdcPlatformEventWrapper(
                      envelope,
                      evt,
                      evtNameMapping.service,
                      sfdcObjectFields,
                    );
                    finalEnvelopes.push(finalEnvelope);
                  } else {
                    logger.error(
                      loggingUtil.composeErrorMessage(
                        "OPERATION_SENDUSERMESSAGES_DESCRIBESOBJECTFAILED",
                        sfdcObjectResponse.errorDetails,
                        correlationKey,
                        `Failed to obtain the fields meta data for sObject '${evtNameMapping.service}' via Salesforce API.`,
                      ),
                    );
                  }
                }
              },
            );
          }
        },
      );

      if (oauth.access_token !== previousToken) {
        // Refresh changed it, so store it
        await (hullClient as any).utils.settings.update({
          refresh_token: oauth.refresh_token,
          access_token: oauth.access_token,
          sfdc_instance_url: oauth.instance_url,
          issued_at: parseInt((oauth as any).issued_at, 10),
        });

        previousToken = cloneDeep(oauth.access_token);
      }

      await asyncForEach(
        finalEnvelopes,
        async (
          envelope: OutgoingOperationEnvelope<
            IHullUserUpdateMessage,
            HullSfdcPlatformEventWrapper
          >,
        ) => {
          if (envelope.operation === "insert") {
            const resp = await serviceClient.postPlatformEvents(
              (envelope.serviceObject as HullSfdcPlatformEventWrapper).sObject,
              (envelope.serviceObject as HullSfdcPlatformEventWrapper).data,
              oauth,
            );

            // TODO: Improve this part of the code
            if ((resp as any).success === true) {
              hullClient
                .asUser(envelope.message.user)
                .logger.info("outgoing.event.success", {
                  id: (resp as any).id,
                  data: envelope.serviceObject,
                });
            } else {
              logger.error(
                loggingUtil.composeErrorMessage(
                  "OPERATION_SENDUSERMESSAGES_INSERTPEFAILED",
                  {
                    errors: (resp as any).errors,
                    sObject: envelope.serviceObject,
                  },
                  correlationKey,
                ),
              );
              hullClient
                .asUser(envelope.message.user)
                .logger.error("outgoing.event.error", {
                  reason: (resp as any).errors
                    ? (resp as any).errors
                        .map((e: any) => {
                          return `${e.message} (Code: ${e.statusCode})`;
                        })
                        .join(" ")
                    : "Unknown reason.",
                });
            }

            if (oauth.access_token !== previousToken) {
              // Refresh changed it, so store it
              await (hullClient as any).utils.settings.update({
                refresh_token: oauth.refresh_token,
                access_token: oauth.access_token,
                sfdc_instance_url: oauth.instance_url,
                issued_at: parseInt((oauth as any).issued_at, 10),
              });

              previousToken = cloneDeep(oauth.access_token);
            }
          } else {
            logger.debug(
              loggingUtil.composeOperationalMessage(
                "OPERATION_SENDUSERMESSAGES_SKIPFINAL",
                correlationKey,
                `Cannot send Hull event to Salesforce: ${
                  envelope.notes ? envelope.notes.join(" ") : "Unknown reason"
                }.`,
              ),
            );

            hullClient
              .asUser(envelope.message.user)
              .logger.info("outgoing.event.skip", {
                reason: envelope.notes
                  ? envelope.notes.join(" ")
                  : "Unknown reason",
              });
          }
        },
      );

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_SENDUSERMESSAGES_SUCCESS",
          correlationKey,
        ),
      );
    } catch (error) {
      logger.error(
        loggingUtil.composeErrorMessage(
          "OPERATION_SENDUSERMESSAGES_UNHANDLED",
          cloneDeep(error),
          correlationKey,
        ),
      );
    }
  }

  /**
   * Determines the overall status of the connector.
   *
   * @returns {Promise<ConnectorStatusResponse>} The status response.
   * @memberof SyncAgent
   */
  public async determineConnectorStatus(): Promise<ConnectorStatusResponse> {
    const logger = this.diContainer.resolve<Logger>("logger");
    const loggingUtil = this.diContainer.resolve<LoggingUtil>("loggingUtil");
    const correlationKey = this.diContainer.resolve<string>("correlationKey");

    const statusResult: ConnectorStatusResponse = {
      status: "ok",
      messages: [],
    };

    try {
      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_CONNECTORSTATUS_START",
          correlationKey,
        ),
      );
      const connectorSettings = this.diContainer.resolve<PrivateSettings>(
        "connectorSettings",
      );
      const hullClient = this.diContainer.resolve<IHullClient>("hullClient");
      const connectorId = this.diContainer.resolve<string>("hullAppId");

      const {
        access_token,
        sfdc_client_id,
        sfdc_client_secret,
        refresh_token,
        sfdc_instance_url,
      } = connectorSettings;

      if (sfdc_client_id === undefined || sfdc_client_secret === undefined) {
        statusResult.status = "setupRequired";
        statusResult.messages.push(VALIDATION_SETUPREQUIRED_CONNECTEDAPP);
      } else if (
        access_token === undefined ||
        refresh_token === undefined ||
        sfdc_instance_url === undefined
      ) {
        statusResult.status = "setupRequired";
        statusResult.messages.push(VALIDATION_SETUPREQUIRED_INITIALAUTH);
      }

      if (statusResult.status === "ok") {
        // TODO: Perform additional checks
      }

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_CONNECTORSTATUS_STARTHULLAPI",
          correlationKey,
        ),
      );

      await hullClient.put(`${connectorId}/status`, statusResult);

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_CONNECTORSTATUS_SUCCESS",
          correlationKey,
        ),
      );
    } catch (error) {
      const logPayload = loggingUtil.composeErrorMessage(
        "OPERATION_CONNECTORSTATUS_UNHANDLED",
        cloneDeep(error),
        correlationKey,
      );
      logger.error(logPayload);
      statusResult.status = "error";
      if (logPayload && logPayload.message) {
        statusResult.messages.push(logPayload.message);
      } else {
        statusResult.messages.push(ERROR_UNHANDLED_GENERIC);
      }
    }

    return statusResult;
  }

  public getOAuthUri(state: string): string {
    const serviceClient = this.diContainer.resolve<ServiceClient>(
      "serviceClient",
    );
    return serviceClient.getAuthUri(state);
  }

  public async getTokenFromCode(code: string): Promise<void> {
    const logger = this.diContainer.resolve<Logger>("logger");
    const loggingUtil = this.diContainer.resolve<LoggingUtil>("loggingUtil");
    const correlationKey = this.diContainer.resolve<string>("correlationKey");

    try {
      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_AUTHTOKENFROMCODE_START",
          correlationKey,
        ),
      );

      const serviceClient = this.diContainer.resolve<ServiceClient>(
        "serviceClient",
      );
      const hullClient = this.diContainer.resolve<IHullClient>("hullClient");

      const resp = await serviceClient.getTokenFromCode(code);

      await (hullClient as any).utils.settings.update({
        refresh_token: resp.refresh_token,
        access_token: resp.access_token,
        sfdc_instance_url: resp.instance_url,
        issued_at: parseInt(resp.issued_at as string, 10),
        sfdc_auth_id: resp.id,
        sfdc_signature: resp.signature,
        sfdc_scope: resp.scope,
      });

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_AUTHTOKENFROMCODE_SUCCESS",
          correlationKey,
        ),
      );
    } catch (error) {
      const logPayload = loggingUtil.composeErrorMessage(
        "OPERATION_AUTHTOKENFROMCODE_UNHANDLED",
        cloneDeep(error),
        correlationKey,
      );
      logger.error(logPayload);
      // Re-throw error to make sure we do not redirect the user
      throw error;
    }
  }

  public async listMetadata(type: string): Promise<unknown> {
    const logger = this.diContainer.resolve<Logger>("logger");
    const loggingUtil = this.diContainer.resolve<LoggingUtil>("loggingUtil");
    const correlationKey = this.diContainer.resolve<string>("correlationKey");

    try {
      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_LISTMETASERVICE_START",
          correlationKey,
        ),
      );

      const serviceClient = this.diContainer.resolve<ServiceClient>(
        "serviceClient",
      );
      const connectorSettings = this.diContainer.resolve<PrivateSettings>(
        "connectorSettings",
      );
      const connectorId = this.diContainer.resolve<string>("hullAppId");

      const cachingUtil = this.diContainer.resolve<CachingUtil>("cachingUtil");
      const hullClient = this.diContainer.resolve<IHullClient>("hullClient");

      let previousToken = cloneDeep(connectorSettings.access_token);
      const oauth = {
        refresh_token: connectorSettings.refresh_token as string,
        access_token: connectorSettings.access_token as string,
        instance_url: connectorSettings.sfdc_instance_url as string,
        issued_at: connectorSettings.issued_at as number,
        id: connectorSettings.sfdc_auth_id as string,
        signature: connectorSettings.sfdc_signature as string,
        scope: connectorSettings.sfdc_scope as string,
      };

      const metaResponse = await cachingUtil.getCachedApiResponse<
        NforceListMetaRequest,
        NforceListMetaResponseObject[]
      >(
        `meta_service_${connectorId}`,
        () => serviceClient.listCustomObjects(oauth),
        10 * 60,
        correlationKey,
      );

      if (oauth.access_token !== previousToken) {
        // Refresh changed it, so store it
        await (hullClient as any).utils.settings.update({
          refresh_token: oauth.refresh_token,
          access_token: oauth.access_token,
          sfdc_instance_url: oauth.instance_url,
          issued_at: parseInt((oauth as any).issued_at, 10),
        });

        previousToken = cloneDeep(oauth.access_token);
      }

      if (metaResponse.success === false || !metaResponse.data) {
        logger.error(
          loggingUtil.composeErrorMessage(
            "OPERATION_LISTMETASERVICE_FAILRETRIEVE",
            metaResponse.errorDetails,
            correlationKey,
          ),
        );
        return Promise.reject(metaResponse.errorDetails);
      }

      let result: any[] = [];
      if (type === "platformevents") {
        const filteredRaw = filter(metaResponse.data, (m) => {
          return endsWith(m.fullName, "__e");
        });
        forEach(filteredRaw, (m: any) => {
          result.push({ value: m.fullName, label: m.fullName });
        });
      }

      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_LISTMETASERVICE_SUCCESS",
          correlationKey,
        ),
      );

      return result;
    } catch (error) {
      console.log(error);
      logger.error(
        loggingUtil.composeErrorMessage(
          "OPERATION_LISTMETASERVICE_UNHANDLED",
          cloneDeep(error),
          correlationKey,
        ),
      );
    }
  }

  /**
   * Determines the authentication status of the connector.
   *
   * @returns {Promise<AuthStatus>} The authentication status.
   * @memberof SyncAgent
   */
  public async determineAuthStatus(): Promise<AuthStatus> {
    const logger = this.diContainer.resolve<Logger>("logger");
    const loggingUtil = this.diContainer.resolve<LoggingUtil>("loggingUtil");
    const correlationKey = this.diContainer.resolve<string>("correlationKey");
    const connectorSettings = this.diContainer.resolve<PrivateSettings>(
      "connectorSettings",
    );

    const result: AuthStatus = {
      statusCode: 200,
      message: "Connected",
    };

    try {
      logger.debug(
        loggingUtil.composeOperationalMessage(
          "OPERATION_AUTHSTATUS_START",
          correlationKey,
        ),
      );

      const {
        access_token,
        sfdc_client_id,
        sfdc_client_secret,
        refresh_token,
        sfdc_instance_url,
      } = connectorSettings;
      if (
        access_token === undefined ||
        sfdc_client_id === undefined ||
        sfdc_client_secret === undefined ||
        refresh_token === undefined ||
        sfdc_instance_url === undefined
      ) {
        result.statusCode = 401;
        result.message = "Connector is not authorized.";
        logger.debug(
          loggingUtil.composeOperationalMessage(
            "OPERATION_AUTHSTATUS_UNAUTHORIZED",
            correlationKey,
          ),
        );
      } else {
        result.message = `Connected to instance '${sfdc_instance_url}'.`;

        logger.debug(
          loggingUtil.composeOperationalMessage(
            "OPERATION_AUTHSTATUS_SUCCESS",
            correlationKey,
          ),
        );
      }
    } catch (error) {
      const logPayload = loggingUtil.composeErrorMessage(
        "OPERATION_AUTHSTATUS_UNHANDLED",
        cloneDeep(error),
        correlationKey,
      );
      logger.error(logPayload);
      result.statusCode = 500;
      if (logPayload && logPayload.message) {
        result.message = logPayload.message;
      } else {
        result.message = ERROR_UNHANDLED_GENERIC;
      }
    }

    return Promise.resolve(result);
  }
}
