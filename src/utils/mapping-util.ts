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

type DefaultFieldType =
  | "Event_Name"
  | "User_Email"
  | "User_External_ID"
  | "Contact_ID"
  | "Lead_ID"
  | "Account_ID";

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
        data: {},
      },
    };

    const configuredFieldNames = fields.map((f) => f.name);
    if (
      configuredFieldNames.includes(this.getDefaultFieldName("Event_Name")) ==
      false
    ) {
      result.operation = "skip";
      if (result.notes) {
        result.notes.push(VALIDATION_SKIP_USEREVENT_MISSINGNAME(sObject));
      } else {
        result.notes = [VALIDATION_SKIP_USEREVENT_MISSINGNAME(sObject)];
      }
      return result;
    } else {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("Event_Name")}`,
        event.event,
      );
    }

    if (
      configuredFieldNames.includes(this.getDefaultFieldName("User_Email")) ===
        true &&
      !isNil(get(envelope.message.user, "email", undefined))
    ) {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("User_Email")}`,
        get(envelope.message.user, "email"),
      );
    }

    if (
      configuredFieldNames.includes(
        this.getDefaultFieldName("User_External_ID"),
      ) === true &&
      !isNil(get(envelope.message.user, "external_id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("User_External_ID")}`,
        get(envelope.message.user, "external_id"),
      );
    }

    if (
      configuredFieldNames.includes(this.getDefaultFieldName("Contact_ID")) ===
        true &&
      !isNil(
        get(envelope.message.user, "traits_salesforce_contact/id", undefined),
      )
    ) {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("Contact_ID")}`,
        get(envelope.message.user, "traits_salesforce_contact/id"),
      );
    }

    if (
      configuredFieldNames.includes(this.getDefaultFieldName("Lead_ID")) ===
        true &&
      !isNil(get(envelope.message.user, "traits_salesforce_lead/id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("Lead_ID")}`,
        get(envelope.message.user, "traits_salesforce_lead/id"),
      );
    }

    if (
      configuredFieldNames.includes(this.getDefaultFieldName("Account_ID")) ===
        true &&
      !isNil(get(envelope.message.account, "salesforce/id", undefined))
    ) {
      set(
        result,
        `serviceObject.data.${this.getDefaultFieldName("Account_ID")}`,
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
      const fieldName = this.createSalesforceFieldName(k);
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

  public createSalesforceFieldName(str: string): string {
    str += "";
    const strSplits = str.split("_");
    for (var i = 0; i < strSplits.length; i++) {
      if (this.privateSettings.sfdc_naming_convention === "lowercase") {
        strSplits[i] = strSplits[i];
      } else {
        strSplits[i] =
          strSplits[i].slice(0, 1).toUpperCase() +
          strSplits[i].slice(1, strSplits[i].length);
      }
    }
    strSplits.push("_c");

    return strSplits.join("_");
  }

  private getDefaultFieldName(defaultType: DefaultFieldType): string {
    let result;
    const useLowerCase =
      this.privateSettings.sfdc_naming_convention === "lowercase";

    switch (defaultType) {
      case "Event_Name":
        result = useLowerCase ? "event_name__c" : "Event_Name__c";
        break;
      case "User_Email":
        result = useLowerCase ? "user_email__c" : "User_Email__c";
        break;
      case "User_External_ID":
        result = useLowerCase ? "user_external_id__c" : "User_External_ID__c";
        break;
      case "Contact_ID":
        result = useLowerCase ? "contact_id__c" : "Contact_ID__c";
        break;
      case "Lead_ID":
        result = useLowerCase ? "lead_id__c" : "Lead_ID__c";
        break;
      case "Account_ID":
        result = useLowerCase ? "account_id__c" : "Account_ID__c";
        break;
      default:
        throw new Error(`Invalid default type: '${defaultType}'`);
    }

    return result;
  }
}
