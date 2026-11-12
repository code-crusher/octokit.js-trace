import {
  App as DefaultApp,
  createNodeMiddleware as createNodeMiddlewareApp,
} from "@octokit/app";
import {
  OAuthApp as DefaultOAuthApp,
  createNodeMiddleware as createNodeMiddlewareOAuthApp,
} from "@octokit/oauth-app";

import { Octokit } from "./octokit.js";

export const App = DefaultApp.defaults({ Octokit });
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

type MiddlewareOptions = {
  pathPrefix?: string;
  log?: App["log"];
};

export function createNodeMiddleware(
  // `oauth` only exists on GitHub App instances, it is used to differentiate
  // between the two app types
  app: App | (OAuthApp & { oauth?: undefined }),
  options?: MiddlewareOptions,
) {
  if (app.oauth) {
    return createNodeMiddlewareApp(app, options);
  }

  return createNodeMiddlewareOAuthApp(app, options);
}
