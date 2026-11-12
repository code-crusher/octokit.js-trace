// ************************************************************
// THIS CODE IS NOT EXECUTED. IT IS JUST FOR TYPECHECKING
// ************************************************************

import {
  App,
  OAuthApp,
  Octokit,
  RequestError,
  composeDeleteDirectory,
  composeDeleteFile,
  composeRenameDirectory,
  composeRenameFile,
} from "../src/index.ts";
import type {
  DeleteOptions,
  FileOperationsResponse,
  RenameOptions,
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

  const octokit = new Octokit();

  const renameOptions: RenameOptions = {
    owner: "",
    repo: "",
    path: "README.md",
    newPath: "RENAMED.md",
    message: "Rename README",
    branch: "main",
    author: { name: "", email: "" },
    committer: { name: "", email: "" },
  };

  const renameResponse = await octokit.renameFile(renameOptions);
  expect<FileOperationsResponse>(renameResponse);
  expect<string>(renameResponse.commit.sha);

  expect<FileOperationsResponse>(await octokit.renameDirectory(renameOptions));

  const deleteOptions: DeleteOptions = {
    owner: "",
    repo: "",
    path: "docs",
    message: "Delete docs",
  };

  const deleteResponse = await octokit.deleteFile(deleteOptions);
  expect<FileOperationsResponse>(deleteResponse);

  expect<FileOperationsResponse>(await octokit.deleteDirectory(deleteOptions));

  expect<FileOperationsResponse>(
    await composeRenameFile(octokit, renameOptions),
  );
  expect<FileOperationsResponse>(
    await composeRenameDirectory(octokit, renameOptions),
  );
  expect<FileOperationsResponse>(
    await composeDeleteFile(octokit, deleteOptions),
  );
  expect<FileOperationsResponse>(
    await composeDeleteDirectory(octokit, deleteOptions),
  );
}
