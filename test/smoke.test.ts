import { describe, expect, it } from "vitest";
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

  // https://github.com/octokit/octokit.js/issues/2968
  it("App can be constructed with `oauth` options only", () => {
    const app = new App({
      oauth: {
        clientId: "lv1.1234567890abcdef",
        clientSecret: "1234567890abcdef1234567890abcdef12345678",
      },
    });

    expect(app.octokit).toBeInstanceOf(Octokit);
    expect(app.oauth).toBeDefined();
    expect(app.oauth.octokit).toBeInstanceOf(Octokit);
  });

  it("App with `oauth` options only keeps custom `Octokit` plugins", () => {
    const MyOctokit = Octokit.plugin(() => ({ foo: "bar" }));

    const app = new App({
      oauth: {
        clientId: "lv1.1234567890abcdef",
        clientSecret: "1234567890abcdef1234567890abcdef12345678",
      },
      Octokit: MyOctokit,
    });

    // @ts-expect-error - `foo` is added by the plugin
    expect(app.octokit.foo).toEqual("bar");
    // @ts-expect-error - `foo` is added by the plugin
    expect(app.oauth.octokit.foo).toEqual("bar");
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
