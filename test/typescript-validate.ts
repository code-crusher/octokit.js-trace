// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import { App, OAuthApp, Octokit, RequestError } from "../src/index.ts";
import type { RestEndpointMethodTypes } from "../src/index.ts";

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
}

export async function RestEndpointMethodTypesTest() {
  const octokit = new Octokit();

  const { data } = await octokit.rest.actions.listRepoWorkflows({
    owner: "",
    repo: "",
  });

  type Workflow =
    RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"][number];

  const workflow: Workflow = data.workflows[0];

  expect<number>(workflow.id);
  expect<string>(workflow.name);

  type ListRepoWorkflowsParameters =
    RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["parameters"];

  expect<ListRepoWorkflowsParameters>({ owner: "", repo: "" });
}
