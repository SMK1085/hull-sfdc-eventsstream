import { ConnectorRedisClient } from "./redis-client";
import { Logger } from "winston";
import { ApiResultObject } from "../core/service-objects";
import { LoggingUtil } from "./logging-util";
import { isNil, cloneDeep } from "lodash";

export class CachingUtil {
  readonly redisClient: ConnectorRedisClient;
  readonly logger: Logger;
  readonly loggingUtil: LoggingUtil;

  constructor(options: any) {
    this.redisClient = options.redisClient;
    this.logger = options.logger;
    this.loggingUtil = options.loggingUtil;
  }

  public async getCachedApiResponse<TPayload, TResult>(
    cacheKey: string,
    fn: () => Promise<ApiResultObject<TPayload, TResult>>,
    expiresSecs?: number,
    correlationKey?: string,
  ): Promise<ApiResultObject<TPayload, TResult>> {
    this.logger.debug(
      this.loggingUtil.composeOperationalMessage(
        "OPERATION_READCACHEDRESULT_START",
        correlationKey,
        `Start reading cached API result with key '${cacheKey}'...`,
      ),
    );

    let result: ApiResultObject<TPayload, TResult> | undefined;
    // Attempt reading from Redis cache
    try {
      result = await this.redisClient.get<ApiResultObject<TPayload, TResult>>(
        cacheKey,
      );
    } catch (error) {
      this.logger.error(
        this.loggingUtil.composeErrorMessage(
          "OPERATION_READCACHEDRESULT_FAILREDISREAD",
          cloneDeep(error),
          correlationKey,
          `Failed to read cached result with key '${cacheKey}' from Redis.`,
        ),
      );
    }

    // Call the API if nothing in Redis cache
    if (isNil(result)) {
      this.logger.debug(
        this.loggingUtil.composeOperationalMessage(
          "OPERATION_READCACHEDRESULT_STARTAPIEXEC",
          correlationKey,
          `Reading cached data with key '${cacheKey}' didn't yield a result, executing API call...`,
        ),
      );

      result = await fn();

      if (result.success) {
        this.logger.debug(
          this.loggingUtil.composeOperationalMessage(
            "OPERATION_READCACHEDRESULT_STARTSAVEREDIS",
            correlationKey,
            `Successfully retrieved API result, storing data in cache '${cacheKey}' and expiration in ${expiresSecs} seconds`,
          ),
        );

        try {
          const cacheResult = await this.redisClient.set(
            cacheKey,
            result,
            expiresSecs,
          );
          this.logger.debug(
            this.loggingUtil.composeOperationalMessage(
              "OPERATION_READCACHEDRESULT_SUCCESSSAVEREDIS",
              correlationKey,
              `Successfully stored API result in cache with key '${cacheKey}': ${cacheResult}.`,
            ),
          );
        } catch (error) {
          this.logger.error(
            this.loggingUtil.composeErrorMessage(
              "OPERATION_READCACHEDRESULT_FAILREDISSAVE",
              cloneDeep(error),
              correlationKey,
              `Failed to store API result in Redis cache with key '${cacheKey}'.`,
            ),
          );
        }
      } else {
        this.logger.error(
          this.loggingUtil.composeErrorMessage(
            "OPERATION_READCACHEDRESULT_FAILAPICALL",
            result.errorDetails || "No details available.",
            correlationKey,
          ),
        );
      }
    } else {
      this.logger.debug(
        this.loggingUtil.composeOperationalMessage(
          "OPERATION_READCACHEDRESULT_SUCCESSSERVINGCACHE",
          correlationKey,
          `Serving API result from cache with key '${cacheKey}'.`,
        ),
      );
    }

    return result;
  }
}
