import { Logger } from "winston";
import { PrivateSettings } from "../core/connector";
import {
  OutgoingOperationEnvelope,
  HullSfdcPlatformEvent,
  HullSfdcPlatformEventWrapper,
  NforceDescribeResponseField,
} from "../core/service-objects";
import IHullUserUpdateMessage from "../types/user-update-message";
import IHullUserEvent from "../types/user-event";
import {
  VALIDATION_SKIP_USEREVENT_MISSINGNAME,
  VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS,
} from "../core/messages";
import { forIn, set, isNil, get, forEach, has } from "lodash";

export class MappingUtil {
  readonly privateSettings: PrivateSettings;
  readonly logger: Logger;

  constructor(options: any) {
    this.privateSettings = options.connectorSettings;
    this.logger = options.logger;
  }

  public mapHullEventToSfdcPlatformEventWrapper(
    envelope: OutgoingOperationEnvelope<
      IHullUserUpdateMessage,
      HullSfdcPlatformEvent
    >,
    event: IHullUserEvent,
    sObject: string,
    fields: NforceDescribeResponseField[],
  ): OutgoingOperationEnvelope<
    IHullUserUpdateMessage,
    HullSfdcPlatformEventWrapper
  > {
    const result: OutgoingOperationEnvelope<
      IHullUserUpdateMessage,
      HullSfdcPlatformEventWrapper
    > = {
      message: envelope.message,
      operation: "insert",
      notes: envelope.notes ? envelope.notes : [],
      serviceObject: {
        sObject,
        data: {
          Event_Name__c: event.event,
        },
      },
    };

    const configuredFieldNames = fields.map((f) => f.name);
    if (configuredFieldNames.includes("Event_Name__c") == false) {
      result.operation = "skip";
      if (result.notes) {
        result.notes.push(VALIDATION_SKIP_USEREVENT_MISSINGNAME(sObject));
      } else {
        result.notes = [VALIDATION_SKIP_USEREVENT_MISSINGNAME(sObject)];
      }
      return result;
    }

    if (
      configuredFieldNames.includes("User_Email__c") === true &&
      !isNil(get(envelope.message.user, "email", undefined))
    ) {
      set(
        result,
        `serviceObject.data.User_Email__c`,
        get(envelope.message.user, "email"),
      );
    }

    if (
      configuredFieldNames.includes("User_External_ID__c") === true &&
      !isNil(get(envelope.message.user, "external_id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.User_External_ID__c`,
        get(envelope.message.user, "external_id"),
      );
    }

    if (
      configuredFieldNames.includes("Contact_ID__c") === true &&
      !isNil(
        get(envelope.message.user, "traits_salesforce_contact/id", undefined),
      )
    ) {
      set(
        result,
        `serviceObject.data.Contact_ID__c`,
        get(envelope.message.user, "traits_salesforce_contact/id"),
      );
    }

    if (
      configuredFieldNames.includes("Lead_ID__c") === true &&
      !isNil(get(envelope.message.user, "traits_salesforce_lead/id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.Lead_ID__c`,
        get(envelope.message.user, "traits_salesforce_lead/id"),
      );
    }

    if (
      configuredFieldNames.includes("Account_ID__c") === true &&
      !isNil(get(envelope.message.account, "salesforce/id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.Account_ID__c`,
        get(envelope.message.account, "salesforce/id"),
      );
    }

    const requiredNonDefaultFieldNames = fields
      .filter(
        (f) =>
          f.nillable === false && f.defaultValue === null && f.custom === true,
      )
      .map((f) => f.name);

    forIn(event.properties, (v, k) => {
      const fieldName = MappingUtil.createSalesforceFieldName(k);
      if (configuredFieldNames.includes(fieldName)) {
        set(result, `serviceObject.data.${fieldName}`, v);
      }
    });

    let hasAllRequiredFields = true;
    const missingFields: string[] = [];
    forEach(requiredNonDefaultFieldNames, (f) => {
      if (!has(result, `serviceObject.data.${f}`)) {
        hasAllRequiredFields = false;
        missingFields.push(f);
      }
    });

    if (!hasAllRequiredFields) {
      result.operation = "skip";
      if (result.notes) {
        result.notes.push(
          VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS(
            sObject,
            missingFields,
          ),
        );
      } else {
        result.notes = [
          VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS(
            sObject,
            missingFields,
          ),
        ];
      }
    }

    return result;
  }

  public static createSalesforceFieldName(str: string): string {
    str += "";
    const strSplits = str.split("_");
    for (var i = 0; i < strSplits.length; i++) {
      strSplits[i] =
        strSplits[i].slice(0, 1).toUpperCase() +
        strSplits[i].slice(1, strSplits[i].length);
    }
    strSplits.push("_c");

    return strSplits.join("_");
  }
}
