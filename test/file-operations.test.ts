import { beforeEach, describe, expect, test } from "vitest";

import nock from "nock";

import {
  Octokit,
  composeDeleteDirectory,
  composeDeleteFile,
  composeRenameDirectory,
  composeRenameFile,
  fileOperations,
} from "../src/index.ts";

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

function mockTree(
  tree: { path: string; mode: string; type: string; sha: string }[],
  {
    treeSha = "tree-sha",
    truncated = false,
  }: { treeSha?: string; truncated?: boolean } = {},
) {
  mock
    .get(`/repos/${owner}/${repo}/git/trees/${treeSha}`)
    .query({ recursive: "1" })
    .reply(200, { sha: treeSha, truncated, tree });
}

function mockCommit({
  baseTreeSha = "tree-sha",
  newTreeSha = "new-tree-sha",
  branch = "main",
} = {}) {
  mock
    .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
      expect(body.base_tree).toEqual(baseTreeSha);
      return true;
    })
    .reply(201, { sha: newTreeSha });

  mock
    .post(`/repos/${owner}/${repo}/git/commits`)
    .reply(201, { ...commit, sha: "commit-sha" });

  mock.patch(`/repos/${owner}/${repo}/git/refs/heads%2F${branch}`).reply(200, {
    ref: `refs/heads/${branch}`,
    object: { sha: "commit-sha" },
  });
}

const tree = [
  { path: "README.md", mode: "100644", type: "blob", sha: "readme-sha" },
  { path: "docs", mode: "040000", type: "tree", sha: "docs-tree-sha" },
  {
    path: "docs/guide.md",
    mode: "100644",
    type: "blob",
    sha: "guide-sha",
  },
  {
    path: "docs/nested",
    mode: "040000",
    type: "tree",
    sha: "nested-tree-sha",
  },
  {
    path: "docs/nested/deep.md",
    mode: "100644",
    type: "blob",
    sha: "deep-sha",
  },
];

const baseOptions = {
  owner,
  repo,
  message: "commit message",
};

describe("fileOperations", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  test("fileOperations is a plugin with a VERSION", () => {
    expect(typeof fileOperations).toEqual("function");
    expect(typeof fileOperations.VERSION).toEqual("string");
  });

  test("Octokit exposes the file operation methods", () => {
    const octokit = new Octokit({ throttle: { enabled: false } });

    expect(octokit.renameFile).toBeInstanceOf(Function);
    expect(octokit.renameDirectory).toBeInstanceOf(Function);
    expect(octokit.deleteFile).toBeInstanceOf(Function);
    expect(octokit.deleteDirectory).toBeInstanceOf(Function);
  });

  describe("renameFile", () => {
    test("renames a file with a single commit", async () => {
      mockBranch();
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body).toEqual({
            base_tree: "tree-sha",
            tree: [
              {
                path: "RENAMED.md",
                mode: "100644",
                type: "blob",
                sha: "readme-sha",
              },
              {
                path: "README.md",
                mode: "100644",
                type: "blob",
                sha: null,
              },
            ],
          });
          return true;
        })
        .reply(201, { sha: "new-tree-sha" });
      mock
        .post(`/repos/${owner}/${repo}/git/commits`, (body) => {
          expect(body).toEqual({
            message: "commit message",
            tree: "new-tree-sha",
            parents: ["head-sha"],
          });
          return true;
        })
        .reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`, {
          sha: "commit-sha",
          force: false,
        })
        .reply(200, { ref: "refs/heads/main", object: { sha: "commit-sha" } });

      const octokit = new Octokit({ throttle: { enabled: false } });
      const result = await octokit.renameFile({
        ...baseOptions,
        path: "README.md",
        newPath: "RENAMED.md",
      });

      expect(result.commit).toEqual(commit);
      expect(result.data).toEqual({
        ref: "refs/heads/main",
        object: { sha: "commit-sha" },
      });
      expect(mock.isDone()).toBe(true);
    });

    test("passes author and committer, normalizes paths and supports a branch", async () => {
      mockBranch({ branch: "feature/x" });
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body.tree[0]).toEqual({
            path: "renamed/README.md",
            mode: "100644",
            type: "blob",
            sha: "readme-sha",
          });
          expect(body.tree[1]).toEqual({
            path: "README.md",
            mode: "100644",
            type: "blob",
            sha: null,
          });
          return true;
        })
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
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Ffeature%2Fx`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      await octokit.renameFile({
        ...baseOptions,
        path: "/README.md/",
        newPath: "/renamed/README.md",
        branch: "feature/x",
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

    test("throws if the source does not exist", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "missing.md",
          newPath: "renamed.md",
        }),
      ).rejects.toThrow(
        'The path "missing.md" does not exist on branch "main".',
      );
    });

    test("throws if the target already exists", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "README.md",
          newPath: "docs/guide.md",
        }),
      ).rejects.toThrow(
        'Cannot rename to "docs/guide.md" because "docs/guide.md" already exists.',
      );
    });

    test("throws if the target is an existing directory", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "README.md",
          newPath: "docs",
        }),
      ).rejects.toThrow(
        'Cannot rename to "docs" because "docs" already exists.',
      );
    });

    test("throws if an ancestor of the target is a file", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "docs/guide.md",
          newPath: "README.md/guide.md",
        }),
      ).rejects.toThrow(
        'Cannot rename to "README.md/guide.md" because "README.md" is a file.',
      );
    });

    test("renames into a directory that does not exist yet", async () => {
      mockBranch();
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body.tree).toEqual([
            {
              path: "a/b/README.md",
              mode: "100644",
              type: "blob",
              sha: "readme-sha",
            },
            { path: "README.md", mode: "100644", type: "blob", sha: null },
          ]);
          return true;
        })
        .reply(201, { sha: "new-tree-sha" });
      mock.post(`/repos/${owner}/${repo}/git/commits`).reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      await octokit.renameFile({
        ...baseOptions,
        path: "README.md",
        newPath: "a/b/README.md",
      });

      expect(mock.isDone()).toBe(true);
    });

    test("throws if the source is a directory", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "docs",
          newPath: "documentation",
        }),
      ).rejects.toThrow(
        'The path "docs" is a directory. Use octokit.renameDirectory() instead.',
      );
    });

    test("throws if path and newPath are identical", async () => {
      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "README.md",
          newPath: "README.md",
        }),
      ).rejects.toThrow(
        'The "path" and "newPath" options must refer to different paths.',
      );
    });

    test("throws for an empty path", async () => {
      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "/",
          newPath: "README.md",
        }),
      ).rejects.toThrow(
        'The "path" option must be a non-empty path relative to the repository root.',
      );
    });

    test("throws for a path referring to the repository root", async () => {
      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: ".",
          newPath: "README.md",
        }),
      ).rejects.toThrow(
        'The "path" option must be a non-empty path relative to the repository root.',
      );
    });

    test("throws if the tree is truncated", async () => {
      mockBranch();
      mockTree(tree, { truncated: true });

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameFile({
          ...baseOptions,
          path: "README.md",
          newPath: "RENAMED.md",
        }),
      ).rejects.toThrow(/the tree is truncated/);
    });
  });

  describe("renameDirectory", () => {
    test("renames a directory and everything in it with a single commit", async () => {
      mockBranch();
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body).toEqual({
            base_tree: "tree-sha",
            tree: [
              {
                path: "documentation/guide.md",
                mode: "100644",
                type: "blob",
                sha: "guide-sha",
              },
              {
                path: "documentation/nested/deep.md",
                mode: "100644",
                type: "blob",
                sha: "deep-sha",
              },
              {
                path: "docs",
                mode: "040000",
                type: "tree",
                sha: null,
              },
            ],
          });
          return true;
        })
        .reply(201, { sha: "new-tree-sha" });
      mock.post(`/repos/${owner}/${repo}/git/commits`).reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      await octokit.renameDirectory({
        ...baseOptions,
        path: "docs",
        newPath: "documentation",
      });

      expect(mock.isDone()).toBe(true);
    });

    test("resolves the default branch when no branch is given", async () => {
      mockBranch({ defaultBranch: "trunk" });
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`)
        .reply(201, { sha: "new-tree-sha" });
      mock.post(`/repos/${owner}/${repo}/git/commits`).reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Ftrunk`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      await octokit.renameDirectory({
        ...baseOptions,
        path: "docs",
        newPath: "documentation",
      });

      expect(mock.isDone()).toBe(true);
    });

    test("throws if the source is not a directory", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameDirectory({
          ...baseOptions,
          path: "README.md",
          newPath: "renamed.md",
        }),
      ).rejects.toThrow(
        'The path "README.md" is not a directory. Use octokit.renameFile() instead.',
      );
    });

    test("throws if the directory is renamed into itself", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameDirectory({
          ...baseOptions,
          path: "docs",
          newPath: "docs/archive",
        }),
      ).rejects.toThrow(
        'Cannot rename the directory "docs" into itself ("docs/archive").',
      );
    });

    test("throws if the target already exists", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameDirectory({
          ...baseOptions,
          path: "docs",
          newPath: "README.md",
        }),
      ).rejects.toThrow(
        'Cannot rename to "README.md" because "README.md" already exists.',
      );
    });

    test("throws if path and newPath are identical", async () => {
      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.renameDirectory({
          ...baseOptions,
          path: "docs",
          newPath: "docs",
        }),
      ).rejects.toThrow(
        'The "path" and "newPath" options must refer to different paths.',
      );
    });
  });

  describe("deleteFile", () => {
    test("deletes a file with a single commit", async () => {
      mockBranch();
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body).toEqual({
            base_tree: "tree-sha",
            tree: [
              {
                path: "README.md",
                mode: "100644",
                type: "blob",
                sha: null,
              },
            ],
          });
          return true;
        })
        .reply(201, { sha: "new-tree-sha" });
      mock.post(`/repos/${owner}/${repo}/git/commits`).reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      const result = await octokit.deleteFile({
        ...baseOptions,
        path: "README.md",
      });

      expect(result.commit).toEqual(commit);
      expect(mock.isDone()).toBe(true);
    });

    test("throws if the source is a directory", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.deleteFile({ ...baseOptions, path: "docs" }),
      ).rejects.toThrow(
        'The path "docs" is a directory. Use octokit.deleteDirectory() instead.',
      );
    });

    test("throws if the source does not exist", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.deleteFile({ ...baseOptions, path: "missing.md" }),
      ).rejects.toThrow(
        'The path "missing.md" does not exist on branch "main".',
      );
    });
  });

  describe("deleteDirectory", () => {
    test("deletes a directory and everything in it with a single commit", async () => {
      mockBranch();
      mockTree(tree);
      mock
        .post(`/repos/${owner}/${repo}/git/trees`, (body) => {
          expect(body).toEqual({
            base_tree: "tree-sha",
            tree: [
              {
                path: "docs",
                mode: "040000",
                type: "tree",
                sha: null,
              },
            ],
          });
          return true;
        })
        .reply(201, { sha: "new-tree-sha" });
      mock.post(`/repos/${owner}/${repo}/git/commits`).reply(201, commit);
      mock
        .patch(`/repos/${owner}/${repo}/git/refs/heads%2Fmain`)
        .reply(200, {});

      const octokit = new Octokit({ throttle: { enabled: false } });
      await octokit.deleteDirectory({ ...baseOptions, path: "docs" });

      expect(mock.isDone()).toBe(true);
    });

    test("throws if the source is not a directory", async () => {
      mockBranch();
      mockTree(tree);

      const octokit = new Octokit({ throttle: { enabled: false } });

      await expect(
        octokit.deleteDirectory({ ...baseOptions, path: "README.md" }),
      ).rejects.toThrow(
        'The path "README.md" is not a directory. Use octokit.deleteFile() instead.',
      );
    });
  });

  describe("compose functions can be used directly", () => {
    test("composeRenameFile", async () => {
      mockBranch();
      mockTree(tree);
      mockCommit();

      const octokit = new Octokit({ throttle: { enabled: false } });
      const result = await composeRenameFile(octokit, {
        ...baseOptions,
        path: "README.md",
        newPath: "RENAMED.md",
      });

      expect(result.commit.sha).toEqual("commit-sha");
      expect(mock.isDone()).toBe(true);
    });

    test("composeRenameDirectory", async () => {
      mockBranch();
      mockTree(tree);
      mockCommit();

      const octokit = new Octokit({ throttle: { enabled: false } });
      await composeRenameDirectory(octokit, {
        ...baseOptions,
        path: "docs",
        newPath: "documentation",
      });

      expect(mock.isDone()).toBe(true);
    });

    test("composeDeleteFile", async () => {
      mockBranch();
      mockTree(tree);
      mockCommit();

      const octokit = new Octokit({ throttle: { enabled: false } });
      await composeDeleteFile(octokit, { ...baseOptions, path: "README.md" });

      expect(mock.isDone()).toBe(true);
    });

    test("composeDeleteDirectory", async () => {
      mockBranch();
      mockTree(tree);
      mockCommit();

      const octokit = new Octokit({ throttle: { enabled: false } });
      await composeDeleteDirectory(octokit, {
        ...baseOptions,
        path: "docs",
      });

      expect(mock.isDone()).toBe(true);
    });
  });
});
