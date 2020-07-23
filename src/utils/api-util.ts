import { ApiMethod, ApiResultObject } from "../core/service-objects";

export class ApiUtil {
  /**
   * Handles errors of an API operation and creates an appropriate result.
   *
   * @static
   * @template T The type of data.
   * @param {string} url The url of the API endpoint
   * @param {Method} method The API method.
   * @param {TPayload} payload The payload data with which the API endpoint has been invoked.
   * @param {any} error The error thrown by the invocation of the API.
   * @returns {ApiResultObject<TPayload, TData, any>} An API result with the properly formatted error messages.
   * @memberof ErrorUtil
   */
  public static handleApiResultError<TPayload, TData>(
    url: string,
    method: ApiMethod,
    payload: TPayload,
    error: any,
  ): ApiResultObject<TPayload, TData> {
    const apiResult: ApiResultObject<TPayload, TData> = {
      data: undefined,
      endpoint: url,
      error: error.message,
      method,
      payload,
      success: false,
      errorDetails: error,
    };

    return apiResult;
  }

  /**
   * Creates a properly composed API result object based on the nforce response data.
   *
   * @static
   * @template T The type of data.
   * @param {string} url The url of the API endpoint.
   * @param {Method} method The API method.
   * @param {TPayload} payload The payload data with which the API endpoint has been invoked.
   * @param {TData} data The response data returned from nforce.
   * @returns {ApiResultObject<TPayload, TData>} A properly composed API result object.
   * @memberof ApiUtil
   */
  public static handleApiResultSuccess<TPayload, TData>(
    url: string,
    method: ApiMethod,
    payload: TPayload,
    data: TData,
  ): ApiResultObject<TPayload, TData> {
    const apiResult: ApiResultObject<TPayload, TData> = {
      data,
      endpoint: url,
      error: undefined,
      method,
      payload,
      success: true,
    };

    return apiResult;
  }
}
