import { describe, expect, test } from "vitest";
import { createServer } from "node:http";

import nock from "nock";

import { OAuthApp, createNodeMiddleware } from "../src/index.ts";

const CLIENT_ID = "lv1.1234567890abcdef";
const CLIENT_SECRET = "1234567890abcdef1234567890abcdef12345678";

describe("OAuthApp", () => {
  test("README example: createNodeMiddleware(oauthApp)", async () => {
    expect.assertions(5);

    const app = new OAuthApp({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    nock("https://github.com")
      .post("/login/oauth/access_token", {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: "123456",
      })
      .reply(200, {
        access_token: "secret123",
        token_type: "bearer",
        scope: "",
      });
    nock("https://api.github.com")
      .put("/repos/octocat/hello-world/subscription")
      .reply(200, { subscribed: true });

    // `token` event handlers are registered directly on the OAuthApp instance
    app.on("token", async ({ token, octokit }) => {
      expect(token).toEqual("secret123");

      await octokit.rest.activity.setRepoSubscription({
        owner: "octocat",
        repo: "hello-world",
        subscribed: true,
      });

      expect(nock.isDone()).toBe(true);
    });

    // Your app can receive the OAuth redirect at /api/github/oauth/callback
    // Users can initiate the OAuth web flow by opening /api/github/oauth/login
    const server = createServer(createNodeMiddleware(app)).listen();

    // @ts-expect-error - port is typed as undefined
    const port = server.address().port;

    const loginResponse = await fetch(
      `http://localhost:${port}/api/github/oauth/login`,
      { redirect: "manual" },
    );
    expect(loginResponse.status).toEqual(302);
    expect(
      loginResponse.headers
        .get("location")
        ?.startsWith("https://github.com/login/oauth/authorize?"),
    ).toBe(true);

    const callbackResponse = await fetch(
      `http://localhost:${port}/api/github/oauth/callback?code=123456`,
    );
    expect(await callbackResponse.text()).toContain("secret123");

    server.close();
  });

  test("README example: getWebFlowAuthorizationUrl", async () => {
    const app = new OAuthApp({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    const { url } = app.getWebFlowAuthorizationUrl({
      redirectUrl: "http://localhost:3000/callback",
    });

    expect(url.startsWith(`https://github.com/login/oauth/authorize?`)).toBe(
      true,
    );
    const searchParams = new URL(url).searchParams;
    expect(searchParams.get("client_id")).toEqual(CLIENT_ID);
    expect(searchParams.get("redirect_uri")).toEqual(
      "http://localhost:3000/callback",
    );
  });
});
