import { describe, expect, it } from "vitest";
import nock from "nock";

import { Octokit, App, OAuthApp, RequestError } from "../src/index.ts";

describe("Smoke tests", () => {
  it("Octokit is a function", () => {
    expect(Octokit).toBeInstanceOf(Function);
    expect(() => new Octokit()).not.toThrow();
  });

  it("Octokit can be used as a type", () => {
    let octokit: Octokit;
    octokit = new Octokit();
    expect(octokit.rest.repos.get).toBeInstanceOf(Function);
  });

  it("App is a function", () => {
    expect(App).toBeInstanceOf(Function);
    expect(
      () =>
        new App({
          appId: 123,
          privateKey: "private key here",
        }),
    ).not.toThrow();
  });

  it("App can be used as a type", () => {
    let app: App;
    app = new App({
      appId: 123,
      privateKey: "private key here",
    });

    expect(app.octokit.request).toBeInstanceOf(Function);
  });

  it("OAuthApp is a function", () => {
    expect(OAuthApp).toBeInstanceOf(Function);
    expect(
      () =>
        new OAuthApp({
          clientId: "",
          clientSecret: "",
        }),
    ).not.toThrow();
  });

  it("OAuthApp can be used as a type", () => {
    let app: OAuthApp;
    app = new OAuthApp({
      clientId: "",
      clientSecret: "",
    });

    expect(app.octokit.request).toBeInstanceOf(Function);
  });

  it("RequestError inherits from Error", () => {
    const error = new RequestError("test", 123, {
      request: {
        method: "GET",
        url: "https://api.github.com/",
        headers: {},
      },
    });

    expect(error).toBeInstanceOf(RequestError);
  });

  it("git.createRef accepts refs with multiple slashes (#2289)", async () => {
    const mock = nock("https://api.github.com");

    mock
      .post("/repos/octokit/octokit.js/git/refs", (body) => {
        expect(body).toStrictEqual({
          ref: "refs/heads/feature/my-feature",
          sha: "valid sha",
        });
        return true;
      })
      .reply(201, {
        ref: "refs/heads/feature/my-feature",
        sha: "valid sha",
        url: "https://api.github.com/repos/octokit/octokit.js/git/refs/heads/feature/my-feature",
        node_id: "R_kwDOACw",
        object: {
          type: "commit",
          sha: "valid sha",
          url: "https://api.github.com/repos/octokit/octokit.js/git/commits/valid sha",
        },
      });

    const octokit = new Octokit({
      auth: "secret123",
      throttle: { enabled: false },
    });

    const response = await octokit.rest.git.createRef({
      owner: "octokit",
      repo: "octokit.js",
      ref: "refs/heads/feature/my-feature",
      sha: "valid sha",
    });

    expect(response.data.ref).toEqual("refs/heads/feature/my-feature");
    expect(mock.isDone()).toBe(true);
  });
});
