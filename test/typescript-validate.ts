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

  const { octokit } = oauthApp;
  expect<Octokit>(octokit);

  // Paginating a known route with request parameters such as `headers`
  // https://github.com/octokit/octokit.js/issues/2439
  const alerts = await octokit.paginate("GET /orgs/{org}/dependabot/alerts", {
    org: "octokit",
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  expect<string | null>(alerts[0].security_advisory.cve_id);

  // Same, with a map function
  const alertNumbers = await octokit.paginate(
    "GET /orgs/{org}/dependabot/alerts",
    {
      org: "octokit",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    (response) => response.data.map((alert) => alert.number),
  );
  expect<number>(alertNumbers[0]);

  // Same, with a map function calling `done()`
  const alertStates = await octokit.paginate(
    "GET /orgs/{org}/dependabot/alerts",
    {
      org: "octokit",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
    (response, done) => {
      done();
      return response.data.map((alert) => alert.state);
    },
  );
  expect<string>(alertStates[0]);

  const error = new RequestError("test", 123, {
    request: {
      method: "GET",
      url: "https://api.github.com/",
      headers: {},
    },
  });

  expect<RequestError>(error);
}
