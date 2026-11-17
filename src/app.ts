import { App as DefaultApp } from "@octokit/app";
import { OAuthApp as DefaultOAuthApp } from "@octokit/oauth-app";
import { createWebMiddleware as webhooksWebMiddleware } from "@octokit/webhooks";
import { createWebWorkerHandler as oauthWebMiddleware } from "@octokit/oauth-app";

import { Octokit } from "./octokit.js";

export const App = DefaultApp.defaults({ Octokit });
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

export { createNodeMiddleware } from "@octokit/app";

export type WebMiddlewareOptions = {
  /** Prefix for all exposed routes, defaults to `/api/github` */
  pathPrefix?: string;
  log?: {
    debug: (...data: unknown[]) => void;
    info: (...data: unknown[]) => void;
    warn: (...data: unknown[]) => void;
    error: (...data: unknown[]) => void;
  };
};

/* v8 ignore next no need to test internals of the middleware setup -- @preserve */
function noop() {}

/**
 * Middleware for environments using the Web Standard API
 * [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and
 * [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects,
 * such as Deno, Bun, Cloudflare Workers, Vercel Edge Runtime, or AWS Lambda.
 *
 * The middleware returns a `Response` if the request matches one of the exposed
 * routes, or `undefined` otherwise, so the request can be handled by other
 * middleware or a catch-all route.
 */
export function createWebMiddleware(
  app: InstanceType<typeof DefaultApp> | InstanceType<typeof DefaultOAuthApp>,
  options: WebMiddlewareOptions = {},
): (request: Request) => Promise<Response | undefined> {
  const log = Object.assign(
    {
      debug: noop,
      info: noop,
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    },
    options.log,
  );

  const optionsWithDefaults = {
    pathPrefix: "/api/github",
    ...options,
    log,
  };

  const webhooksMiddleware =
    "webhooks" in app && app.webhooks
      ? webhooksWebMiddleware(app.webhooks, {
          path: optionsWithDefaults.pathPrefix + "/webhooks",
          log,
        })
      : undefined;

  const oauthMiddleware = oauthWebMiddleware(
    "oauth" in app ? app.oauth : (app as OAuthApp),
    {
      pathPrefix: optionsWithDefaults.pathPrefix + "/oauth",
    },
  );

  return middleware.bind(
    null,
    optionsWithDefaults.pathPrefix,
    webhooksMiddleware,
    oauthMiddleware,
  );
}

async function middleware(
  pathPrefix: string,
  webhooksMiddleware: ReturnType<typeof webhooksWebMiddleware> | undefined,
  oauthMiddleware: ReturnType<typeof oauthWebMiddleware>,
  request: Request,
): Promise<Response | undefined> {
  const { pathname } = new URL(request.url, "http://localhost");

  if (!pathname.startsWith(`${pathPrefix}/`)) {
    return undefined;
  }

  if (webhooksMiddleware && pathname === `${pathPrefix}/webhooks`) {
    return webhooksMiddleware(request);
  }

  if (pathname.startsWith(`${pathPrefix}/oauth/`)) {
    return oauthMiddleware(request);
  }

  return new Response(
    JSON.stringify({
      error: `Unknown route: ${request.method} ${pathname}`,
    }),
    {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}
