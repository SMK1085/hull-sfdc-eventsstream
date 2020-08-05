export interface NforceConnectionOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
  environment: string;
  mode: "multi" | "single";
  autoRefresh?: boolean;
}
export interface NforceAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  signature: string;
  scope: string;
  id_token?: string | null;
  instance_url: string;
  id: string;
  token_type?: string | null;
  issued_at: string | number;
}

export type OutgoingOperationType = "insert" | "skip";

export interface OutgoingOperationEnvelope<T, U> {
  message: T;
  serviceId?: number;
  serviceObject?: U;
  operation: OutgoingOperationType;
  notes?: string[];
}

export interface OutgoingOperationEnvelopesFiltered<T, U> {
  inserts: OutgoingOperationEnvelope<T, U>[];
  skips: OutgoingOperationEnvelope<T, U>[];
}

export interface HullSfdcPlatformEvent {
  Contact_ID__c?: string | null;
  Lead_ID__c?: string | null;
  Account_ID__c?: string | null;
  User_Email__c?: string | null;
  User_External_ID__c?: string | null;
  Event_Name__c?: string;
  contact_id__c?: string | null;
  lead_id__c?: string | null;
  account_id__c?: string | null;
  user_email__c?: string | null;
  user_external_id__c?: string | null;
  event_name__c?: string;
  [key: string]: boolean | Date | string | number | null | undefined;
}

export interface HullSfdcPlatformEventWrapper {
  sObject: string;
  data: HullSfdcPlatformEvent;
}

export type ApiMethod = "insert" | "describe" | "list";

export interface ApiResultObject<TPayload, TResult> {
  endpoint: string;
  method: ApiMethod;
  payload: TPayload | undefined;
  data: TResult | undefined;
  success: boolean;
  error?: string | string[];
  errorDetails?: any[];
}

export interface NforceDescribeRequest {
  type: string;
  oauth: NforceAuthTokenResponse;
}

export interface NforceDescribeResponseField {
  aggregatable: boolean;
  aiPredictionField: boolean;
  autoNumber: boolean;
  byteLength: number;
  calculated: boolean;
  calculatedFormula: null | any;
  cascadeDelete: boolean;
  caseSensitive: boolean;
  compoundFieldName: null | string;
  controllerName: null | string;
  createable: boolean;
  custom: boolean;
  defaultValue: null | any;
  defaultValueFormula: null | any;
  defaultedOnCreate: boolean;
  dependentPicklist: boolean;
  deprecatedAndHidden: boolean;
  digits: number;
  displayLocationInDecimal: boolean;
  encrypted: boolean;
  externalId: boolean;
  extraTypeInfo: null;
  filterable: boolean;
  filteredLookupInfo: null | any;
  formulaTreatNullNumberAsZero: boolean;
  groupable: boolean;
  highScaleNumber: boolean;
  htmlFormatted: boolean;
  idLookup: boolean;
  inlineHelpText: null | string;
  label: string;
  length: number;
  mask: null | any;
  maskType: null | any;
  name: string;
  nameField: boolean;
  namePointing: boolean;
  nillable: boolean;
  permissionable: boolean;
  picklistValues: any[];
  polymorphicForeignKey: boolean;
  precision: number;
  queryByDistance: boolean;
  referenceTargetField: null | any;
  referenceTo: any[];
  relationshipName: null | any;
  relationshipOrder: null | any;
  restrictedDelete: boolean;
  restrictedPicklist: boolean;
  scale: number;
  searchPrefilterable: boolean;
  soapType: string;
  sortable: boolean;
  type: string;
  unique: boolean;
  updateable: boolean;
  writeRequiresMasterRead: boolean;
}

export interface NforceDescribeResponse {
  actionOverrides: any[];
  activateable: boolean;
  childRelationships: {
    cascadeDelete: boolean;
    childSObject: string;
    deprecatedAndHidden: boolean;
    field: string;
    junctionIdListNames: any[];
    junctionReferenceTo: any[];
    relationshipName: null | string;
    restrictedDelete: boolean;
  }[];
  compactLayoutable: boolean;
  createable: boolean;
  custom: boolean;
  customSetting: boolean;
  deepCloneable: boolean;
  defaultImplementation: null | any;
  deletable: boolean;
  deprecatedAndHidden: boolean;
  extendedBy: null | any;
  extendsInterfaces: null | any;
  feedEnabled: boolean;
  fields: NforceDescribeResponseField[];
}

export interface NforceListMetaRequest {
  oauth: NforceAuthTokenResponse;
  queries: { type: string }[];
}

export interface NforceListMetaResponseObject {
  createdById: string;
  createdByName: string;
  createdDate: string;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: string;
  namespacePrefix: string;
  type: string;
}
