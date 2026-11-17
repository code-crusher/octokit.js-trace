import { describe, expect, it } from "vitest";
import { Octokit, App, OAuthApp, RequestError } from "../src/index.ts";

describe("Smoke tests", () => {
  it("Octokit is a function", () => {
    expect(Octokit).toBeInstanceOf(Function);
    expect(() => new Octokit()).not.toThrow();
  });

  // Regression test for https://github.com/octokit/octokit.js/issues/2079:
  // Instantiating Octokit must not schedule any timers, because in Deno (and
  // other restricted runtimes) an active `setInterval` keeps the process
  // from exiting. @octokit/plugin-throttling used to eagerly create
  // Bottleneck instances (and their auto-cleanup intervals) in its factory.
  it("constructor does not schedule any timers", () => {
    const calls: string[] = [];
    const originalSetInterval = globalThis.setInterval;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
      calls.push("setInterval");
      return originalSetInterval(...args);
    }) as typeof setInterval;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      calls.push("setTimeout");
      return originalSetTimeout(...args);
    }) as typeof setTimeout;

    try {
      new Octokit();
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.setTimeout = originalSetTimeout;
    }

    expect(calls).toEqual([]);
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
});
