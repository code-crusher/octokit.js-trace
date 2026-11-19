// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import {
  App,
  GraphqlResponseError,
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

  const error = new RequestError("test", 123, {
    request: {
      method: "GET",
      url: "https://api.github.com/",
      headers: {},
    },
  });

  expect<RequestError>(error);

  const graphqlError = new GraphqlResponseError(
    {
      method: "POST",
      url: "/graphql",
      query: "query { viewer { login } }",
    },
    {},
    {
      data: { login: "octocat" },
      errors: [
        {
          type: "SERVICE_UNAVAILABLE",
          message: "Service unavailable",
          path: ["viewer"],
          extensions: {},
          locations: [{ line: 1, column: 1 }],
        },
      ],
    },
  );

  expect<GraphqlResponseError<{ login: string }>>(graphqlError);
}
