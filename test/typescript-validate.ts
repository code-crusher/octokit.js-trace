// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import { App, OAuthApp, Octokit, RequestError } from "../src/index.ts";

function expect<T>(what: T) {}

export async function OctokitTest() {
  const app = new App({
    appId: 1,
    privateKey: "",
  });

  expect<Octokit>(app.octokit);

  // https://github.com/octokit/octokit.js/issues/2968
  // `appId` and `privateKey` are not required when `App` is used for OAuth only
  const oauthOnlyApp = new App({
    oauth: {
      clientId: "",
      clientSecret: "",
    },
  });

  expect<Octokit>(oauthOnlyApp.octokit);
  expect<Octokit>(oauthOnlyApp.oauth.octokit);

  oauthOnlyApp.oauth.on("token.created", ({ octokit }) => {
    expect<Octokit>(octokit);
  });

  const oauthApp = new OAuthApp({
    clientId: "",
    clientSecret: "",
  });

  expect<Octokit>(oauthApp.octokit);

  const installationOctokit = await app.getInstallationOctokit(1);
  const issues = await installationOctokit.paginate(
    installationOctokit.rest.issues.listForRepo,
    {
      owner: "",
      repo: "",
    },
  );
  expect<number>(issues[0].id);

  const error = new RequestError("test", 123, {
    request: {
      method: "GET",
      url: "https://api.github.com/",
      headers: {},
    },
  });

  expect<RequestError>(error);
}
