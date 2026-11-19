// Deno tests for the published `octokit` package.
//
// These tests import the package the same way users on Deno do: from npm and
// from esm.sh. `deno test` type-checks by default, so these tests also guard
// against regressions in the published type declarations, which the Node.js
// test suite cannot catch.
//
// Run with `npm run test:deno`.
import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";

import {
  Octokit as OctokitFromNpm,
  App as AppFromNpm,
  OAuthApp as OAuthAppFromNpm,
  RequestError as RequestErrorFromNpm,
} from "npm:octokit";

import {
  Octokit as OctokitFromEsmSh,
  App as AppFromEsmSh,
  OAuthApp as OAuthAppFromEsmSh,
  RequestError as RequestErrorFromEsmSh,
} from "https://esm.sh/octokit?dts";

const APP_ID = 1;
const PRIVATE_KEY = "private key here";

// Resolves without making a network request, so the tests work offline.
const mockFetch: typeof globalThis.fetch = async () =>
  new Response(JSON.stringify({ id: 1, name: "octokit.js" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

// This file is type-checked when it runs, so a broken type declaration makes
// the test suite fail.
function expectType<T>(_value: T): void {}

Deno.test("Octokit can be imported from npm", async () => {
  const octokit: OctokitFromNpm = new OctokitFromNpm({
    request: { fetch: mockFetch },
  });

  assert(typeof OctokitFromNpm === "function");
  assertEquals(typeof octokit.rest.repos.get, "function");
  assertEquals(typeof octokit.paginate, "function");
  assertEquals(typeof octokit.graphql, "function");

  const { data } = await octokit.request("GET /repos/{owner}/{repo}", {
    owner: "octokit",
    repo: "octokit.js",
  });
  assertEquals(data.name, "octokit.js");
});

Deno.test("Octokit can be imported from esm.sh", async () => {
  const octokit: OctokitFromEsmSh = new OctokitFromEsmSh({
    request: { fetch: mockFetch },
  });

  assert(typeof OctokitFromEsmSh === "function");
  assertEquals(typeof octokit.rest.repos.get, "function");
  assertEquals(typeof octokit.paginate, "function");
  assertEquals(typeof octokit.graphql, "function");

  const { data } = await octokit.request("GET /repos/{owner}/{repo}", {
    owner: "octokit",
    repo: "octokit.js",
  });
  assertEquals(data.name, "octokit.js");
});

Deno.test("App can be imported from npm", () => {
  const app: AppFromNpm = new AppFromNpm({
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
  });

  expectType<OctokitFromNpm>(app.octokit);
  assertEquals(typeof app.octokit.request, "function");
});

Deno.test("App can be imported from esm.sh", () => {
  const app: AppFromEsmSh = new AppFromEsmSh({
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
  });

  expectType<OctokitFromEsmSh>(app.octokit);
  assertEquals(typeof app.octokit.request, "function");
});

Deno.test("OAuthApp can be imported from npm", () => {
  const oauthApp: OAuthAppFromNpm = new OAuthAppFromNpm({
    clientId: "",
    clientSecret: "",
  });

  expectType<OctokitFromNpm>(oauthApp.octokit);
  assertEquals(typeof oauthApp.octokit.request, "function");
});

Deno.test("OAuthApp can be imported from esm.sh", () => {
  const oauthApp: OAuthAppFromEsmSh = new OAuthAppFromEsmSh({
    clientId: "",
    clientSecret: "",
  });

  expectType<OctokitFromEsmSh>(oauthApp.octokit);
  assertEquals(typeof oauthApp.octokit.request, "function");
});

Deno.test("RequestError can be imported from npm", () => {
  const error: RequestErrorFromNpm = new RequestErrorFromNpm("test", 123, {
    request: { method: "GET", url: "https://api.github.com/", headers: {} },
  });

  assert(error instanceof Error);
  assertEquals(error.status, 123);
});

Deno.test("RequestError can be imported from esm.sh", () => {
  const error: RequestErrorFromEsmSh = new RequestErrorFromEsmSh("test", 123, {
    request: { method: "GET", url: "https://api.github.com/", headers: {} },
  });

  assert(error instanceof Error);
  assertEquals(error.status, 123);
});
