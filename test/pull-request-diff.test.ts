import { afterEach, describe, expect, test } from "vitest";
import nock from "nock";

import { Octokit } from "../src/index.ts";

const octokit = new Octokit({
  auth: "token123",
  throttle: { enabled: false },
});

describe("pull request diff_url and patch_url", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("diff_url is sent to the REST API with the diff media type", async () => {
    const mock = nock("https://api.github.com", {
      reqheaders: {
        accept: "application/vnd.github.v3.diff",
        authorization: "token token123",
      },
    })
      .get("/repos/octokit/octokit.js/pulls/1")
      .reply(200, "diff --git a/README.md b/README.md", {
        "content-type": "application/vnd.github.v3.diff; charset=utf-8",
      });

    const { status, data } = await octokit.request({
      method: "GET",
      url: "https://github.com/octokit/octokit.js/pull/1.diff",
    });

    expect(status).toEqual(200);
    expect(data).toEqual("diff --git a/README.md b/README.md");
    expect(mock.isDone()).toBe(true);
  });

  test("patch_url is sent to the REST API with the patch media type", async () => {
    const mock = nock("https://api.github.com", {
      reqheaders: { accept: "application/vnd.github.v3.patch" },
    })
      .get("/repos/octokit/octokit.js/pulls/1")
      .reply(200, "From 1234567 Mon Sep 17 00:00:00 2001", {
        "content-type": "application/vnd.github.v3.patch; charset=utf-8",
      });

    const { status, data } = await octokit.request({
      method: "GET",
      url: "https://github.com/octokit/octokit.js/pull/1.patch",
    });

    expect(status).toEqual(200);
    expect(data).toEqual("From 1234567 Mon Sep 17 00:00:00 2001");
    expect(mock.isDone()).toBe(true);
  });

  test("www.github.com diff_url is rewritten as well", async () => {
    const mock = nock("https://api.github.com", {
      reqheaders: { accept: "application/vnd.github.v3.diff" },
    })
      .get("/repos/octokit/octokit.js/pulls/1")
      .reply(200, "diff --git a/README.md b/README.md", {
        "content-type": "application/vnd.github.v3.diff; charset=utf-8",
      });

    const { status } = await octokit.request({
      method: "GET",
      url: "https://www.github.com/octokit/octokit.js/pull/1.diff?w=1",
    });

    expect(status).toEqual(200);
    expect(mock.isDone()).toBe(true);
  });

  test("non-GET requests are not rewritten", async () => {
    const mock = nock("https://github.com")
      .post("/octokit/octokit.js/pull/1.diff")
      .reply(200, "ok", { "content-type": "text/plain; charset=utf-8" });

    const { status } = await octokit.request({
      method: "POST",
      url: "https://github.com/octokit/octokit.js/pull/1.diff",
    });

    expect(status).toEqual(200);
    expect(mock.isDone()).toBe(true);
  });

  test("other github.com URLs are not rewritten", async () => {
    const mock = nock("https://github.com")
      .get("/octokit/octokit.js")
      .reply(200, "<html></html>", { "content-type": "text/html" });

    const { status } = await octokit.request({
      method: "GET",
      url: "https://github.com/octokit/octokit.js",
    });

    expect(status).toEqual(200);
    expect(mock.isDone()).toBe(true);
  });

  test("requests without a URL are not affected", async () => {
    const mock = nock("https://api.github.com")
      .get("/")
      .reply(200, {}, { "content-type": "application/json" });

    const { status } = await octokit.request({ method: "GET" });

    expect(status).toEqual(200);
    expect(mock.isDone()).toBe(true);
  });
});
