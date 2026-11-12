import { App as DefaultApp } from "@octokit/app";
import { OAuthApp as DefaultOAuthApp } from "@octokit/oauth-app";
import type { Octokit as OctokitCore } from "@octokit/core";

import { Octokit } from "./octokit.js";

const MISSING_INSTALLATION_ID =
  "[@octokit/auth-app] installationId option is required for installation authentication.";

/**
 * `App` authenticates requests as the app for routes that require app
 * authentication and as an installation for all other routes. Without an
 * `installationId` there is no installation to authenticate as, so requests
 * to public endpoints such as `GET /users` fail with an "installationId
 * option is required" error.
 *
 * Wrap the authentication strategy so that such requests are sent without
 * authentication instead. Requests to routes that require app authentication
 * are unaffected.
 */
function withUnauthenticatedFallback(authStrategy: any) {
  return (options: any) => {
    const strategy = authStrategy(options);

    return Object.assign((...args: any[]) => strategy(...args), {
      hook: async (request: any, route: any, parameters?: any) => {
        try {
          return await strategy.hook(request, route, parameters);
        } catch (error) {
          if ((error as Error).message !== MISSING_INSTALLATION_ID) {
            throw error;
          }

          return request(request.endpoint.merge(route, parameters));
        }
      },
    });
  };
}

/**
 * Returns a copy of the given `Octokit` class that falls back to
 * unauthenticated requests when app authentication is used without an
 * `installationId`.
 */
function withFallback(Base: typeof OctokitCore) {
  return Base.defaults((options: any) => ({
    ...options,
    authStrategy: withUnauthenticatedFallback(options.authStrategy),
  }));
}

const DefaultAppWithOctokit = DefaultApp.defaults({ Octokit });

type AppOptions = ConstructorParameters<typeof DefaultAppWithOctokit>[0];

class AppWithUnauthenticatedFallback extends DefaultAppWithOctokit {
  constructor(options: AppOptions) {
    super({
      ...options,
      // `App.defaults({ Octokit })` allows replacing the `Octokit` class
      Octokit: withFallback(options.Octokit || Octokit),
    });
  }
}

export const App = AppWithUnauthenticatedFallback;
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

export { createNodeMiddleware } from "@octokit/app";
