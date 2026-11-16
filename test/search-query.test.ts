import { describe, expect, it } from "vitest";
import nock from "nock";

import { Octokit } from "../src/index.ts";

// Regression tests for https://github.com/octokit/octokit.js/issues/2172.
//
// The search endpoints take the raw search query in the `q` parameter,
// e.g. `user:pawper topic:portfolio-project`. Octokit encodes it exactly
// once — callers must neither pre-encode the value nor include a `q=`
// prefix in it, otherwise GitHub searches for the literal encoded text
// and returns no results.
describe("search endpoint query strings (#2172)", () => {
  it("sends the q parameter encoded exactly once", async () => {
    const octokit = new Octokit();

    const paths: string[] = [];
    const scope = nock("https://api.github.com")
      .get("/search/repositories")
      .query(true)
      .reply(200, function (this: nock.ReplyFnContext) {
        paths.push(this.req.path);
        return { total_count: 1, items: [] };
      });

    const { data } = await octokit.rest.search.repos({
      q: "user:pawper topic:portfolio-project",
    });

    expect(data.total_count).toBe(1);
    expect(paths).toEqual([
      "/search/repositories?q=user%3Apawper%20topic%3Aportfolio-project",
    ]);
    scope.done();
  });

  it("keeps '+' as a search term separator in the q parameter", async () => {
    const octokit = new Octokit();

    const paths: string[] = [];
    const scope = nock("https://api.github.com")
      .get("/search/repositories")
      .query(true)
      .reply(200, function (this: nock.ReplyFnContext) {
        paths.push(this.req.path);
        return { total_count: 1, items: [] };
      });

    await octokit.request("GET /search/repositories", {
      q: "GitHub+Octocat+in:readme+user:defunkt",
    });

    expect(paths).toEqual([
      "/search/repositories?q=GitHub+Octocat+in%3Areadme+user%3Adefunkt",
    ]);
    scope.done();
  });

  it("double-encodes a pre-encoded q parameter (user error described in #2172)", async () => {
    const octokit = new Octokit();

    const paths: string[] = [];
    const scope = nock("https://api.github.com")
      .get("/search/repositories")
      .query(true)
      .reply(200, function (this: nock.ReplyFnContext) {
        paths.push(this.req.path);
        return { total_count: 0, items: [] };
      });

    // This is what the issue reporter did: passing an already-encoded
    // string (with a `q=` prefix) as the value of `q`. GitHub then
    // searches for the literal encoded text, hence 0 results.
    await octokit.rest.search.repos({
      q: "q=" + encodeURIComponent("user:pawper topic:portfolio-project"),
    } as any);

    expect(paths[0]).toBe(
      "/search/repositories?q=q%3Duser%253Apawper%2520topic%253Aportfolio-project",
    );
    scope.done();
  });
});
