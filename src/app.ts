import { App as DefaultApp } from "@octokit/app";
import { OAuthApp as DefaultOAuthApp } from "@octokit/oauth-app";
import type { Octokit as CoreOctokit, OctokitOptions } from "@octokit/core";

import { Octokit } from "./octokit.js";

type ConstructorOptions = ConstructorParameters<typeof DefaultApp>[0];
type Options = Omit<ConstructorOptions, "appId" | "privateKey">;
type OAuthOptions = NonNullable<Options["oauth"]>;

/**
 * Constructor options for `App`.
 *
 * `appId` and `privateKey` are required for GitHub App authentication. They
 * can be omitted when the `App` instance is only used for its OAuth
 * functionality, e.g. `new App({ oauth: { clientId, clientSecret } })`.
 */
export type AppOptions =
  | ConstructorOptions
  | (Options & {
      appId?: undefined;
      privateKey?: undefined;
      oauth: OAuthOptions;
    });

type OctokitClassType<TOptions extends Options> =
  TOptions["Octokit"] extends typeof CoreOctokit
    ? TOptions["Octokit"]
    : typeof Octokit;

type OctokitType<TOptions extends Options> = InstanceType<
  OctokitClassType<TOptions>
>;

const AppWithDefaults = DefaultApp.defaults({ Octokit });

type AppWithDefaultsInstance = InstanceType<typeof AppWithDefaults>;

/**
 * Instance type of `App` when constructed with OAuth options only. Same as
 * the regular `App` instance type, but with the `octokit` types derived from
 * the `Octokit` constructor option.
 */
type OAuthOnlyApp<TOptions extends Options> = AppWithDefaultsInstance & {
  octokit: OctokitType<TOptions>;
  oauth: DefaultOAuthApp<{
    clientType: "github-app";
    Octokit: OctokitClassType<TOptions>;
  }>;
};

class AppWithOptionalAppCredentials extends AppWithDefaults {
  constructor(options: AppOptions) {
    super(withOAuthOnlyOctokit(options) as ConstructorOptions);
  }
}

export const App = AppWithOptionalAppCredentials as typeof AppWithDefaults & {
  new <TOptions extends Options & { oauth: OAuthOptions }>(
    options: TOptions,
  ): OAuthOnlyApp<TOptions>;
};
export type App = InstanceType<typeof App>;

export const OAuthApp = DefaultOAuthApp.defaults({ Octokit });
export type OAuthApp = InstanceType<typeof OAuthApp>;

export { createNodeMiddleware } from "@octokit/app";

/**
 * `@octokit/app` always creates its `octokit` instance with `createAppAuth`,
 * which throws when `appId` is not set. When `App` is created with OAuth
 * options only, there are no app credentials to authenticate with, so create
 * the instance without authentication instead.
 */
function withOAuthOnlyOctokit(options: AppOptions): AppOptions {
  if (options.appId != null || options.privateKey != null || !options.oauth) {
    return options;
  }

  return {
    ...options,
    Octokit: (options.Octokit || Octokit).defaults(withoutAppAuthentication),
  };
}

function withoutAppAuthentication(options: OctokitOptions): OctokitOptions {
  // `App` always passes `auth.appId`, `app.oauth` creates its `Octokit`
  // instance with OAuth app authentication instead, which must be kept.
  if (
    options.auth &&
    typeof options.auth === "object" &&
    "appId" in options.auth
  ) {
    const { authStrategy, auth, ...octokitOptions } = options;
    return octokitOptions;
  }

  return options;
}
