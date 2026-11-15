import { App as DefaultApp } from "@octokit/app";
import { OAuthApp as DefaultOAuthApp } from "@octokit/oauth-app";
import {
  createNodeMiddleware as oauthNodeMiddleware,
  sendNodeResponse,
  unknownRouteResponse,
} from "@octokit/oauth-app";
import { createNodeMiddleware as webhooksNodeMiddleware } from "@octokit/webhooks";

import { Octokit } from "./octokit.js";

export const App = DefaultApp.defaults({ Octokit });
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

export type MiddlewareOptions = {
  pathPrefix?: string;
  log?: App["log"];
};

/**
 * Returns the result of `getter()` or `undefined` if it throws.
 *
 * `app.webhooks` and `app.oauth` are implemented as getters that throw when
 * the respective constructor option was not set. Accessing them here must not
 * fail: `createNodeMiddleware()` only mounts the routes for the options that
 * are actually configured.
 */
function getIfConfigured<T>(getter: () => T): T | undefined {
  try {
    return getter();
  } catch {
    return undefined;
  }
}

export function createNodeMiddleware(
  app: App,
  options: MiddlewareOptions = {},
) {
  const pathPrefix = options.pathPrefix ?? "/api/github";
  const webhooks = getIfConfigured(() => app.webhooks);
  const oauth = getIfConfigured(() => app.oauth);

  const webhooksMiddleware = webhooks
    ? webhooksNodeMiddleware(webhooks, {
        path: `${pathPrefix}/webhooks`,
        ...(options.log ? { log: options.log } : {}),
      })
    : undefined;
  const oauthMiddleware = oauth
    ? oauthNodeMiddleware(oauth, { pathPrefix: `${pathPrefix}/oauth` })
    : undefined;

  return async function middleware(
    request: any,
    response: any,
    next?: Function,
  ) {
    const { pathname } = new URL(request.url, "http://localhost");

    if (!pathname.startsWith(`${pathPrefix}/`)) {
      next?.();
      return false;
    }

    if (pathname === `${pathPrefix}/webhooks`) {
      if (webhooksMiddleware) {
        await webhooksMiddleware(request, response);
      } else {
        sendNodeResponse(unknownRouteResponse(request), response);
      }
    } else if (pathname.startsWith(`${pathPrefix}/oauth/`)) {
      if (oauthMiddleware) {
        await oauthMiddleware(request, response);
      } else {
        sendNodeResponse(unknownRouteResponse(request), response);
      }
    } else {
      sendNodeResponse(unknownRouteResponse(request), response);
    }

    return true;
  };
}
