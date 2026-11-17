import {
  App as DefaultApp,
  createNodeMiddleware as createAppNodeMiddleware,
} from "@octokit/app";
import {
  OAuthApp as DefaultOAuthApp,
  createNodeMiddleware as createOAuthAppNodeMiddleware,
  type HandlerOptions,
} from "@octokit/oauth-app";

import { Octokit } from "./octokit.js";

export const App = DefaultApp.defaults({ Octokit });
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

// `request` and `response` are intentionally typed as `any` for Deno
// compatibility, see https://github.com/octokit/octokit.js/issues/2075#issuecomment-817361886
type NodeMiddleware = (
  request: any,
  response: any,
  next?: Function,
) => Promise<boolean>;

type AppMiddlewareOptions = {
  pathPrefix?: string;
  log?: {
    debug: (...data: any[]) => void;
    info: (...data: any[]) => void;
    warn: (...data: any[]) => void;
    error: (...data: any[]) => void;
  };
};

/**
 * Create a Node.js middleware for either a GitHub `App` or an `OAuthApp`.
 *
 * For `App`, the middleware handles webhooks at `<pathPrefix>/webhooks` and
 * delegates OAuth routes to the app's internal `OAuthApp` instance.
 * For `OAuthApp`, only the OAuth routes are handled.
 */
export function createNodeMiddleware(
  app: App,
  options?: AppMiddlewareOptions,
): NodeMiddleware;
export function createNodeMiddleware(
  app: OAuthApp,
  options?: HandlerOptions,
): NodeMiddleware;
export function createNodeMiddleware(
  app: App | OAuthApp,
  options?: AppMiddlewareOptions & HandlerOptions,
): NodeMiddleware {
  if ("webhooks" in app) {
    return createAppNodeMiddleware(app, options);
  }

  return createOAuthAppNodeMiddleware(app, options);
}
