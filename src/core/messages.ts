export const VALIDATION_CODES = {
  VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT: "VAL-10-001",
  VALIDATION_SKIP_USEREVENTS_NOTWHITELISTED: "VAL-10-002",
  VALIDATION_SKIP_USER_NOTEXISTINGINSFDC: "VAL-10-003",
  VALIDATION_SKIP_USEREVENT_MISSINGNAME: "VAL-11-001",
  VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS: "VAL-11-002",
  VALIDATION_SETUPREQUIRED_CONNECTEDAPP: "VAL-01-001",
  VALIDATION_SETUPREQUIRED_INITIALAUTH: "VAL-01-002",
};

export const VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT = (
  objectType: "user" | "account",
) => {
  return `Hull ${objectType} won't be synchronized since it is not matching any of the filtered segments. [Code: ${VALIDATION_CODES.VALIDATION_SKIP_HULLOBJECT_NOTINANYSEGMENT}]`;
};

export const VALIDATION_SKIP_USEREVENTS_NOTWHITELISTED = `None of the whitelisted events occurred, no data will be sent to Salesforce. [Code: ${VALIDATION_CODES.VALIDATION_SKIP_USEREVENTS_NOTWHITELISTED}]`;

export const VALIDATION_SKIP_USER_NOTEXISTINGINSFDC = `The user has not been already synchronized as a lead or contact, no data will be sent to Salesforce. [Code: ${VALIDATION_CODES.VALIDATION_SKIP_USER_NOTEXISTINGINSFDC}]`;

export const VALIDATION_SKIP_USEREVENT_MISSINGNAME = (sObject: string) =>
  `The Salesforce Object '${sObject}' doesn't have a field configured with the API name 'Event_Name__c' which is manadatory. (Code: ${VALIDATION_CODES.VALIDATION_SKIP_USEREVENT_MISSINGNAME})`;

export const VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS = (
  sObject: string,
  missingFields: string[],
) =>
  `Converting the Hull event to the Salesforce Object '${sObject}' didn't yielded in the following required fields with no defaults to have no value: ${missingFields.join(
    ", ",
  )}. Cannot send the Hull event to Salesforce. (Code: ${
    VALIDATION_CODES.VALIDATION_SKIP_USEREVENT_MISSINGREQUIREDFIELDS
  })`;

export const VALIDATION_SETUPREQUIRED_CONNECTEDAPP = `You haven't configured the 'Salesforce OAuth Client ID' and/or 'Salesforce OAuth Client Secret' in the Settings. See the documentation for details. (Code: ${VALIDATION_CODES.VALIDATION_SETUPREQUIRED_CONNECTEDAPP})`;
export const VALIDATION_SETUPREQUIRED_INITIALAUTH = `You haven't authorized the Connector with your Salesforce Instance. Use the Connect button in the Settings section 'Connection'. (Code: ${VALIDATION_CODES.VALIDATION_SETUPREQUIRED_INITIALAUTH})`;
export const ERROR_UNHANDLED_GENERIC = `An unhandled error occurred and our engineering team has been notified.`;
