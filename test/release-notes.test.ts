import { afterEach, describe, expect, it } from "vitest";
import nock from "nock";

import { Octokit } from "../src/index.ts";

// Regression tests for https://github.com/octokit/octokit.js/issues/2171.
//
// The issue asked for a `GET /repos/{owner}/{repo}/releases/notes` endpoint
// method. That route does not exist in GitHub's REST API (it is not part of
// GitHub's OpenAPI specification and `GET` on it returns `404`). The
// supported way to obtain automatically generated release notes is
// `POST /repos/{owner}/{repo}/releases/generate-notes`, which is exposed as
// `octokit.rest.repos.generateReleaseNotes()`. The generated notes are
// returned as `{ name, body }` and can be passed straight to
// `octokit.rest.repos.createRelease()`.
describe("generated release notes (#2171)", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("`octokit.rest.repos.generateReleaseNotes` posts to the generate-notes endpoint", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    const scope = nock("https://api.github.com")
      .post("/repos/octokit/octokit.js/releases/generate-notes", {
        tag_name: "v1.0.0",
        target_commitish: "main",
        previous_tag_name: "v0.9.0",
      })
      .reply(200, {
        name: "v1.0.0",
        body: "## What's Changed\n* Add a feature by @octocat in https://github.com/octokit/octokit.js/pull/1",
      });

    const { data } = await octokit.rest.repos.generateReleaseNotes({
      owner: "octokit",
      repo: "octokit.js",
      tag_name: "v1.0.0",
      target_commitish: "main",
      previous_tag_name: "v0.9.0",
    });

    expect(data.name).toBe("v1.0.0");
    expect(data.body).toContain("What's Changed");
    expect(scope.isDone()).toBe(true);
  });

  it("the generated notes can be used to create a release", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    nock("https://api.github.com")
      .post("/repos/octokit/octokit.js/releases/generate-notes", {
        tag_name: "v1.0.0",
      })
      .reply(200, { name: "v1.0.0", body: "generated body" });

    const { data: notes } = await octokit.rest.repos.generateReleaseNotes({
      owner: "octokit",
      repo: "octokit.js",
      tag_name: "v1.0.0",
    });

    const scope = nock("https://api.github.com")
      .post("/repos/octokit/octokit.js/releases", {
        tag_name: "v1.0.0",
        name: notes.name,
        body: notes.body,
      })
      .reply(201, {
        id: 1,
        tag_name: "v1.0.0",
        name: notes.name,
        body: notes.body,
      });

    const { data: release } = await octokit.rest.repos.createRelease({
      owner: "octokit",
      repo: "octokit.js",
      tag_name: "v1.0.0",
      name: notes.name,
      body: notes.body,
    });

    expect(release.body).toBe("generated body");
    expect(scope.isDone()).toBe(true);
  });

  it("`octokit.request` can be used to call the endpoint directly", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    const scope = nock("https://api.github.com")
      .post("/repos/octokit/octokit.js/releases/generate-notes", {
        tag_name: "v1.0.0",
      })
      .reply(200, { name: "v1.0.0", body: "generated body" });

    const { data } = await octokit.request(
      "POST /repos/{owner}/{repo}/releases/generate-notes",
      {
        owner: "octokit",
        repo: "octokit.js",
        tag_name: "v1.0.0",
      },
    );

    expect(data.body).toBe("generated body");
    expect(scope.isDone()).toBe(true);
  });
});
