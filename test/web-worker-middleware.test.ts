import { beforeEach, describe, expect, test } from "vitest";

import nock from "nock";

import {
  OAuthApp,
  createWebWorkerHandler,
  handleRequest as handleOctokitRequest,
  unknownRouteResponse,
} from "../src/index.ts";

const CLIENT_ID = "lv1.1234567890abcdef";
const CLIENT_SECRET = "1234567890abcdef1234567890abcdef12345678";
const FIXTURE_URL = "http://localhost:8000";

// See https://github.com/octokit/octokit.js/issues/2535
// Deno Fresh (like Cloudflare Workers) handlers receive a Fetch API `Request`
// and must respond with a `Response`. The Node middleware cannot be used there.
describe("createWebWorkerHandler", () => {
  let app: InstanceType<typeof OAuthApp>;
  const mock = nock("https://github.com");

  beforeEach(() => {
    nock.cleanAll();

    app = new OAuthApp({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
  });

  test("is exported from octokit", () => {
    expect(createWebWorkerHandler).toBeInstanceOf(Function);
  });

  test("GET /api/github/oauth/login redirects to the GitHub authorization url", async () => {
    const handleRequest = createWebWorkerHandler(app);

    const response = await handleRequest(
      new Request(
        `${FIXTURE_URL}/api/github/oauth/login?state=abc123&scopes=repo`,
      ),
    );

    expect(response).toBeInstanceOf(Response);
    expect(response!.status).toEqual(302);
    expect(response!.headers.get("location")).toEqual(
      `https://github.com/login/oauth/authorize?allow_signup=true&client_id=${CLIENT_ID}&scope=repo&state=abc123`,
    );
  });

  test("OPTIONS request responds with CORS headers", async () => {
    const handleRequest = createWebWorkerHandler(app);

    const response = await handleRequest(
      new Request(`${FIXTURE_URL}/api/github/oauth/login`, {
        method: "OPTIONS",
      }),
    );

    expect(response!.status).toEqual(200);
    expect(response!.headers.get("access-control-allow-origin")).toEqual("*");
    expect(response!.headers.get("access-control-allow-methods")).toEqual("*");
  });

  test("POST /api/github/oauth/token exchanges the code for a token", async () => {
    expect.assertions(4);

    app.on("token.created", ({ token }) => {
      expect(token).toEqual("secret123");
    });

    mock
      .post("/login/oauth/access_token", {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: "123456",
      })
      .matchHeader("accept", "application/json")
      .reply(200, {
        access_token: "secret123",
        scope: "",
        token_type: "bearer",
      });

    const handleRequest = createWebWorkerHandler(app);
    const response = await handleRequest(
      new Request(`${FIXTURE_URL}/api/github/oauth/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "123456" }),
      }),
    );

    expect(response!.status).toEqual(201);
    const result = JSON.parse(await response!.text());
    expect(result.authentication.clientSecret).toBeUndefined();
    expect(result.authentication.token).toEqual("secret123");
  });

  test("GET /api/github/oauth/token requires an Authorization header", async () => {
    const handleRequest = createWebWorkerHandler(app);

    const response = await handleRequest(
      new Request(`${FIXTURE_URL}/api/github/oauth/token`),
    );

    expect(response!.status).toEqual(400);
    expect(JSON.parse(await response!.text())).toEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  test("returns undefined for paths outside the path prefix so the framework can continue", async () => {
    const handleRequest = createWebWorkerHandler(app);

    const response = await handleRequest(
      new Request(`${FIXTURE_URL}/some/other/route`),
    );

    // In Deno Fresh, a middleware would call `ctx.next()` in this case
    expect(response).toBeUndefined();
  });

  test("respects a custom path prefix", async () => {
    const handleRequest = createWebWorkerHandler(app, {
      pathPrefix: "/api/oauth",
    });

    const defaultPrefixResponse = await handleRequest(
      new Request(`${FIXTURE_URL}/api/github/oauth/login`),
    );
    expect(defaultPrefixResponse).toBeUndefined();

    const customPrefixResponse = await handleRequest(
      new Request(`${FIXTURE_URL}/api/oauth/login`),
    );
    expect(customPrefixResponse).toBeInstanceOf(Response);
    expect(customPrefixResponse!.status).toEqual(302);
  });

  test("unknown route under the path prefix responds with 404", async () => {
    const handleRequest = createWebWorkerHandler(app);

    const response = await handleRequest(
      new Request(`${FIXTURE_URL}/api/github/oauth/unknown`),
    );

    expect(response!.status).toEqual(404);
    expect(JSON.parse(await response!.text())).toEqual({
      error: `Unknown route: GET ${FIXTURE_URL}/api/github/oauth/unknown`,
    });
  });

  test("unknownRouteResponse and handleRequest are exported for custom middlewares", async () => {
    expect(unknownRouteResponse).toBeInstanceOf(Function);
    expect(handleOctokitRequest).toBeInstanceOf(Function);

    const request = {
      method: "GET",
      url: `${FIXTURE_URL}/api/github/oauth/login`,
      headers: {},
      text: async () => "",
    };
    const response = await handleOctokitRequest(app, {}, request);

    expect(response!.status).toEqual(302);
    expect(response!.headers.location).toContain(
      "https://github.com/login/oauth/authorize",
    );
  });
});
