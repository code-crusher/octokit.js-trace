// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import {
  App,
  createWebMiddleware,
  OAuthApp,
  Octokit,
  RequestError,
} from "../src/index.ts";

function expect<T>(what: T) {}

export async function OctokitTest() {
  const app = new App({
    appId: 1,
    privateKey: "",
  });

  expect<Octokit>(app.octokit);

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

  const webMiddleware = createWebMiddleware(app);
  const webMiddlewareResponse = await webMiddleware(
    new Request("https://example.com/api/github/webhooks"),
  );
  expect<Response | undefined>(webMiddlewareResponse);

  const oauthWebMiddleware = createWebMiddleware(oauthApp);
  const oauthWebMiddlewareResponse = await oauthWebMiddleware(
    new Request("https://example.com/api/github/oauth/login"),
  );
  expect<Response | undefined>(oauthWebMiddlewareResponse);

  const error = new RequestError("test", 123, {
    request: {
      method: "GET",
      url: "https://api.github.com/",
      headers: {},
    },
  });

  expect<RequestError>(error);
}
