import { Octokit as OctokitCore } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

import { VERSION } from "./version.js";
import type { EndpointDefaults, RequestParameters } from "@octokit/types";
import type { PaginatingEndpoints } from "@octokit/plugin-paginate-rest";

export { RequestError } from "@octokit/request-error";
export type {
  PageInfoForward,
  PageInfoBackward,
} from "@octokit/plugin-paginate-graphql";

export const Octokit = OctokitCore.plugin(
  restEndpointMethods,
  paginateRest,
  paginateGraphQL,
  retry,
  throttling,
).defaults({
  userAgent: `octokit.js/${VERSION}`,
  throttle: {
    onRateLimit,
    onSecondaryRateLimit,
  },
});

export type Octokit = InstanceType<typeof Octokit>;

declare module "@octokit/plugin-paginate-rest" {
  interface PaginateInterface {
    /**
     * Paginate a request using a known endpoint route string, request parameters,
     * and map each response to a custom array
     *
     * @param {string} route Request method + URL. Example: `'GET /orgs/{org}'`
     * @param {object} parameters URL, query or body parameters, as well as `headers`, `mediaType.format`, `request`, or `baseUrl`.
     * @param {function} mapFn Optional method to map each response to a custom array
     */
    <R extends keyof PaginatingEndpoints, M extends unknown[]>(
      route: R,
      parameters: PaginatingEndpoints[R]["parameters"] & RequestParameters,
      mapFn: (
        response: PaginatingEndpoints[R]["response"],
        done: () => void,
      ) => M,
    ): Promise<M>;
    /**
     * Paginate a request using a known endpoint route string and request parameters
     *
     * @param {string} route Request method + URL. Example: `'GET /orgs/{org}'`
     * @param {object} parameters? URL, query or body parameters, as well as `headers`, `mediaType.format`, `request`, or `baseUrl`.
     */
    <R extends keyof PaginatingEndpoints>(
      route: R,
      parameters?: PaginatingEndpoints[R]["parameters"] & RequestParameters,
    ): Promise<
      "data" extends keyof PaginatingEndpoints[R]["response"]
        ? PaginatingEndpoints[R]["response"]["data"]
        : unknown
    >;
  }
}

/* v8 ignore next no need to test internals of the throttle plugin -- @preserve */
function onRateLimit(
  retryAfter: number,
  options: Required<EndpointDefaults>,
  octokit: InstanceType<typeof OctokitCore>,
) {
  octokit.log.warn(
    `Request quota exhausted for request ${options.method} ${options.url}`,
  );

  if (options.request.retryCount === 0) {
    // only retries once
    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
    return true;
  }
}

/* v8 ignore next no need to test internals of the throttle plugin -- @preserve */
function onSecondaryRateLimit(
  retryAfter: number,
  options: Required<EndpointDefaults>,
  octokit: InstanceType<typeof OctokitCore>,
) {
  octokit.log.warn(
    `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
  );

  if (options.request.retryCount === 0) {
    // only retries once
    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
    return true;
  }
}
