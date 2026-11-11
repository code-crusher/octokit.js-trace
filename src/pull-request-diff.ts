import type { Octokit } from "@octokit/core";

// `diff_url` and `patch_url` properties returned by GitHub (on pull request
// objects and in webhook payloads) point to github.com. Those URLs are meant
// for the web UI: they only work for public repositories and do not accept
// token authentication, so requesting them for a private repository always
// results in a 404. The same diff and patch are available from the REST API
// using the `application/vnd.github.v3.diff` and `application/vnd.github.v3.patch`
// media types, which do support token authentication. We rewrite such URLs to
// the equivalent REST API request so they work for private repositories, too.
const PULL_REQUEST_DIFF_URL =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\.(diff|patch)(?:[?#].*)?$/;

export function pullRequestDiff(octokit: Octokit) {
  octokit.hook.before("request", (options) => {
    const match = options.url?.match(PULL_REQUEST_DIFF_URL);
    if (!match || !["GET", "HEAD"].includes(options.method.toUpperCase())) {
      return;
    }

    const [, owner, repo, pullNumber, format] = match;
    options.url = `/repos/${owner}/${repo}/pulls/${pullNumber}`;
    options.mediaType = { ...options.mediaType, format };
  });
}
