import { describe, expect, it } from "vitest";
import nock from "nock";

import { Octokit } from "../src/index.ts";

describe("GET /repos/{owner}/{repo}/pulls", () => {
  it("forwards the `head` filter to the request URL", async () => {
    const octokit = new Octokit({ auth: "token" });
    const requests: string[] = [];

    nock("https://api.github.com")
      .get(/.*/)
      .times(2)
      .reply(function (uri) {
        requests.push(uri);
        return [200, []];
      });

    await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner: "octokit",
      repo: "octokit.js",
      head: "octokit:main",
    });

    await octokit.rest.pulls.list({
      owner: "octokit",
      repo: "octokit.js",
      head: "octokit:main",
    });

    expect(requests).toEqual([
      "/repos/octokit/octokit.js/pulls?head=octokit%3Amain",
      "/repos/octokit/octokit.js/pulls?head=octokit%3Amain",
    ]);
  });

  it("forwards `head` together with the `state` filter", async () => {
    const octokit = new Octokit({ auth: "token" });
    let requestUri: string | undefined;

    nock("https://api.github.com")
      .get(/.*/)
      .reply(function (uri) {
        requestUri = uri;
        return [200, []];
      });

    await octokit.rest.pulls.list({
      owner: "octokit",
      repo: "octokit.js",
      head: "octokit:feature/branch",
      state: "all",
    });

    expect(requestUri).toBe(
      "/repos/octokit/octokit.js/pulls?head=octokit%3Afeature%2Fbranch&state=all",
    );
  });

  it("uses the `head.label` value of a pull request as `head` filter (issue #2710)", async () => {
    const octokit = new Octokit({ auth: "token" });
    const requests: string[] = [];

    nock("https://api.github.com")
      .get("/repos/octokit/octokit.js/pulls/91")
      .reply(200, {
        number: 91,
        state: "closed",
        head: { label: "org:branchname", ref: "branchname" },
      });

    nock("https://api.github.com")
      .get(/.*/)
      .reply(function (uri) {
        requests.push(uri);
        return [200, []];
      });

    const { data: pull } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: "octokit",
        repo: "octokit.js",
        pull_number: 91,
      },
    );

    await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner: "octokit",
      repo: "octokit.js",
      head: pull.head.label,
    });

    expect(requests).toEqual([
      "/repos/octokit/octokit.js/pulls?head=org%3Abranchname",
    ]);
  });
});
