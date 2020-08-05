import nforce from "nforce";
// import nforceMeta from "nforce-metadata";
import {
  NforceAuthTokenResponse,
  ApiResultObject,
  NforceDescribeRequest,
  NforceDescribeResponse,
  ApiMethod,
  NforceListMetaRequest,
  NforceListMetaResponseObject,
} from "./service-objects";
import { forIn, cloneDeep } from "lodash";
import { ApiUtil } from "../utils/api-util";

export class ServiceClient {
  private readonly org: any;

  constructor(options: any) {
    this.org = nforce.createConnection({
      ...options.nforceOptions,
    });
  }

  public async listCustomObjects(
    oauth: any,
  ): Promise<
    ApiResultObject<NforceListMetaRequest, NforceListMetaResponseObject[]>
  > {
    const url = `https://${oauth.instance_url}/services/Soap/c/v49.0/describeSObjects`;
    const method: ApiMethod = "list";
    const payload: NforceListMetaRequest = {
      oauth,
      queries: [{ type: "CustomObject" }],
    };
    try {
      const data = await this.org.meta.listMetadata(payload);
      return ApiUtil.handleApiResultSuccess(url, method, payload, data);
    } catch (error) {
      console.log(error);
      return ApiUtil.handleApiResultError(
        url,
        method,
        payload,
        cloneDeep(error),
      );
    }
  }

  public async describeCustomObject(
    payload: NforceDescribeRequest,
  ): Promise<ApiResultObject<NforceDescribeRequest, NforceDescribeResponse>> {
    const url = `https://${payload.oauth.instance_url}/services/data/v49.0/sobjects/${payload.type}/describe`;
    const method: ApiMethod = "describe";

    try {
      const data = await this.org.getDescribe(payload);

      return ApiUtil.handleApiResultSuccess(url, method, payload, data);
    } catch (error) {
      return ApiUtil.handleApiResultError(
        url,
        method,
        payload,
        cloneDeep(error),
      );
    }
  }

  public async postPlatformEvents(
    sObjectName: string,
    data: any,
    oauth: any,
  ): Promise<unknown> {
    const pe = nforce.createSObject(sObjectName);
    forIn(data, (v, k) => {
      pe.set(k, v);
    });

    const result = await this.org.insert({ sobject: pe, oauth });

    return result;
  }

  public getAuthUri(state: string): string {
    console.log("state", state);
    const redirectUri = this.org.getAuthUri({
      state,
    });

    return redirectUri;
  }

  public async getTokenFromCode(
    code: string,
  ): Promise<NforceAuthTokenResponse> {
    const resp = await this.org.authenticate({ code });
    console.log(">>> Response", resp);
    return resp;
  }
}
