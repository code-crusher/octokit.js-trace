// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import {
  App,
  OAuthApp,
  Octokit,
  RequestError,
  composeUploadFiles,
  uploadFiles,
} from "../src/index.ts";
import type { UploadFilesOptions, UploadFilesResponse } from "../src/index.ts";

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

export async function UploadFilesTest() {
  expect<typeof uploadFiles>(uploadFiles);

  const octokit = new Octokit();

  const options: UploadFilesOptions = {
    owner: "",
    repo: "",
    message: "",
    files: {
      "index.js": "console.log('hello');",
      "assets/logo.png": { content: "", encoding: "base64" },
    },
    branch: "main",
    author: { name: "", email: "" },
    committer: { name: "", email: "", date: "" },
  };

  const response = await octokit.uploadFiles(options);
  expect<UploadFilesResponse>(response);
  expect<string>(response.commit.sha);

  expect<UploadFilesResponse>(await composeUploadFiles(octokit, options));
}
