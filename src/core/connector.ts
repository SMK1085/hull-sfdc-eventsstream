export interface PrivateSettings {
  sfdc_environment: string;
  sfdc_api_version: string;
  sfdc_client_id?: string | null;
  sfdc_client_secret?: string | null;
  event_mappings: HullEventMapping[];
  refresh_token?: string | null;
  access_token?: string | null;
  sfdc_instance_url?: string | null;
  issued_at?: number | null;
  sfdc_auth_id?: string | null;
  sfdc_signature?: string | null;
  sfdc_scope?: string | null;
  user_synchronized_segments: string[];
  user_filter_only_existing?: boolean | null;
}

export interface HullEventMapping {
  hull: string;
  service: string;
}

export interface LogPayload {
  channel: "operational" | "metric" | "error";
  component: string;
  code: string;
  message?: string | null;
  metricKey?: string | null;
  metricValue?: number | null;
  errorDetails?: any | null;
  appId: string;
  tenantId: string;
  correlationKey?: string;
}
