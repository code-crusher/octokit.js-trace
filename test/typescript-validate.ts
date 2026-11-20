// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import {
  App,
  OAuthApp,
  Octokit,
  RequestError,
  createWebWorkerHandler,
  handleRequest,
  unknownRouteResponse,
} from "../src/index.ts";
import type {
  HandlerOptions,
  OctokitRequest,
  OctokitResponse,
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

  const handleOAuthRequest = createWebWorkerHandler(oauthApp);
  const oauthResponse = await handleOAuthRequest(
    new Request("https://example.com/api/github/oauth/login"),
  );
  expect<Response | undefined>(oauthResponse);

  const octokitRequest: OctokitRequest = {
    method: "GET",
    url: "https://example.com/api/github/oauth/login",
    headers: {},
    text: async () => "",
  };
  const options: HandlerOptions = { pathPrefix: "/api/github/oauth" };
  const response: OctokitResponse | undefined = await handleRequest(
    oauthApp,
    options,
    octokitRequest,
  );
  expect<OctokitResponse | undefined>(response);

  const unknownRoute: OctokitResponse = unknownRouteResponse(octokitRequest);
  expect<OctokitResponse>(unknownRoute);

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
