import { beforeEach, describe, expect, test } from "vitest";

import nock from "nock";

import { Octokit, composeUploadFiles, uploadFiles } from "../src/index.ts";

const mock = nock("https://api.github.com");

const owner = "octokit";
const repo = "octokit.js";

const commit = {
  sha: "commit-sha",
  node_id: "node-id",
  url: "https://api.github.com/repos/octokit/octokit.js/git/commits/commit-sha",
  html_url: "https://github.com/octokit/octokit.js/commit/commit-sha",
  author: { date: "2025-01-01T00:00:00Z", email: "a@b.c", name: "A" },
  committer: { date: "2025-01-01T00:00:00Z", email: "a@b.c", name: "A" },
  tree: {
    sha: "new-tree-sha",
    url: "https://api.github.com/repos/octokit/octokit.js/git/trees/new-tree-sha",
  },
  message: "commit message",
  parents: [],
};

function mockBranch({
  branch,
  commitSha = "head-sha",
  treeSha = "tree-sha",
  defaultBranch = "main",
}: {
  branch?: string;
  commitSha?: string;
  treeSha?: string;
  defaultBranch?: string;
} = {}) {
  // Without an explicit branch, the implementation resolves the repository's
  // default branch first.
  if (branch === undefined) {
    mock.get(`/repos/${owner}/${repo}`).reply(200, {
      default_branch: defaultBranch,
    });
  }

  const branchName = branch ?? defaultBranch;

  mock
    .get(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branchName)}`)
    .reply(200, {
      name: branchName,
      commit: { sha: commitSha, commit: { tree: { sha: treeSha } } },
    });
}

function mockBlob(
  content: string,
  {
    sha = "blob-sha",
    encoding = "utf-8",
  }: { sha?: string; encoding?: string } = {},
) {
  mock
    .post(`/repos/${owner}/${repo}/git/blobs`, (body) => {
      expect(body).toEqual({ content, encoding });
      return true;
    })
    .reply(201, { sha });
}

function mockCommit({
  baseTreeSha = "tree-sha",
  newTreeSha = "new-tree-sha",
  branch = "main",
  tree,
}: {
  baseTreeSha?: string;
  newTreeSha?: string;
  branch?: string;
  tree: unknown[];
}) {
  mock
    .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
      expect(body).toEqual({ base_tree: baseTreeSha, tree });
      return true;
    })
    .reply(201, { sha: newTreeSha });

  mock
    .post(`/repos/${owner}/${repo}/git/commits`)
    .reply(201, { ...commit, sha: "commit-sha" });

  mock
    .patch(
      `/repos/${owner}/${repo}/git/refs/heads%2F${encodeURIComponent(branch)}`,
    )
    .reply(200, {
      ref: `refs/heads/${branch}`,
      object: { sha: "commit-sha" },
    });
}

const baseOptions = {
  owner,
  repo,
  message: "commit message",
};

describe("uploadFiles", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  test("uploadFiles is a plugin with a VERSION", () => {
    expect(typeof uploadFiles).toEqual("function");
    expect(typeof uploadFiles.VERSION).toEqual("string");
  });

  test("Octokit exposes the uploadFiles method", () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    expect(octokit.uploadFiles).toBeInstanceOf(Function);
  });

  test("uploads multiple files in a single commit", async () => {
    mockBranch();
    mockBlob("console.log('hello');", { sha: "index-sha" });
    mockBlob("# my-project", { sha: "readme-sha" });
    mockCommit({
      tree: [
        {
          path: "my-project/index.js",
          mode: "100644",
          type: "blob",
          sha: "index-sha",
        },
        {
          path: "my-project/README.md",
          mode: "100644",
          type: "blob",
          sha: "readme-sha",
        },
      ],
    });

    const octokit = new Octokit({ throttle: { enabled: false } });
    const result = await octokit.uploadFiles({
      ...baseOptions,
      files: {
        "my-project/index.js": "console.log('hello');",
        "my-project/README.md": "# my-project",
      },
    });

    expect(result.commit).toEqual(commit);
    expect(result.data).toEqual({
      ref: "refs/heads/main",
      object: { sha: "commit-sha" },
    });
    expect(mock.isDone()).toBe(true);
  });

  test("supports base64 encoded content, nested folders and path normalization", async () => {
    mockBranch({ branch: "feature/x" });
    mockBlob("aGVsbG8=", { sha: "binary-sha", encoding: "base64" });
    mockBlob("text", { sha: "text-sha" });
    mockCommit({
      branch: "feature/x",
      tree: [
        {
          path: "my-project/assets/logo.png",
          mode: "100644",
          type: "blob",
          sha: "binary-sha",
        },
        {
          path: "my-project/index.js",
          mode: "100644",
          type: "blob",
          sha: "text-sha",
        },
      ],
    });

    const octokit = new Octokit({ throttle: { enabled: false } });
    await octokit.uploadFiles({
      ...baseOptions,
      branch: "feature/x",
      files: {
        "/my-project/assets/logo.png": {
          content: "aGVsbG8=",
          encoding: "base64",
        },
        "/my-project/index.js/": { content: "text" },
      },
    });

    expect(mock.isDone()).toBe(true);
  });

  test("passes author and committer", async () => {
    mockBranch();
    mockBlob("content");
    mock
      .post(`/repos/${owner}/${repo}/git/trees`)
      .reply(201, { sha: "new-tree-sha" });
    mock
      .post(`/repos/${owner}/${repo}/git/commits`, (body) => {
        expect(body.author).toEqual({
          name: "Author",
          email: "author@example.com",
          date: "2025-01-01T00:00:00Z",
        });
        expect(body.committer).toEqual({
          name: "Committer",
          email: "committer@example.com",
        });
        return true;
      })
      .reply(201, commit);
    mock.patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`).reply(200, {});

    const octokit = new Octokit({ throttle: { enabled: false } });
    await octokit.uploadFiles({
      ...baseOptions,
      files: { "file.txt": "content" },
      author: {
        name: "Author",
        email: "author@example.com",
        date: "2025-01-01T00:00:00Z",
      },
      committer: {
        name: "Committer",
        email: "committer@example.com",
      },
    });

    expect(mock.isDone()).toBe(true);
  });

  test("composeUploadFiles accepts an Octokit instance", async () => {
    mockBranch();
    mockBlob("content");
    mockCommit({
      tree: [
        {
          path: "file.txt",
          mode: "100644",
          type: "blob",
          sha: "blob-sha",
        },
      ],
    });

    const octokit = new Octokit({ throttle: { enabled: false } });
    await composeUploadFiles(octokit, {
      ...baseOptions,
      files: { "file.txt": "content" },
    });

    expect(mock.isDone()).toBe(true);
  });

  test("throws if no files are provided", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    await expect(
      octokit.uploadFiles({ ...baseOptions, files: {} }),
    ).rejects.toThrow(
      'The "files" option must contain at least one file to upload.',
    );
  });

  test("throws for an empty path", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    await expect(
      octokit.uploadFiles({ ...baseOptions, files: { "/": "content" } }),
    ).rejects.toThrow(
      'The file path "/" must be a non-empty path relative to the repository root.',
    );
  });

  test("throws if two paths normalize to the same path", async () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    await expect(
      octokit.uploadFiles({
        ...baseOptions,
        files: { "file.txt": "a", "/file.txt": "b" },
      }),
    ).rejects.toThrow('The file path "file.txt" is used more than once.');
  });
});
