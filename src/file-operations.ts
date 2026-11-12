import type { Octokit } from "@octokit/core";
import type { Endpoints } from "@octokit/types";

import { VERSION } from "./version.js";

type GitCommit =
  Endpoints["POST /repos/{owner}/{repo}/git/commits"]["response"]["data"];
type GitTree =
  Endpoints["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"]["response"]["data"];
type GitTreeEntry = GitTree["tree"][number];
type TreeParameter = NonNullable<
  Endpoints["POST /repos/{owner}/{repo}/git/trees"]["parameters"]["tree"]
>;
type TreeParameterEntry = TreeParameter[number];

/**
 * Information about the author or committer of a commit.
 */
export type CommitUser = {
  name: string;
  email: string;
  date?: string;
};

type CommonOptions = {
  owner: string;
  repo: string;
  /** Path of the file or directory, relative to the repository root. */
  path: string;
  message: string;
  /**
   * Branch to commit to. Defaults to the repository's default branch.
   */
  branch?: string;
  author?: CommitUser;
  committer?: CommitUser;
};

export type RenameOptions = CommonOptions & {
  /** New path of the file or directory, relative to the repository root. */
  newPath: string;
};

export type DeleteOptions = CommonOptions;

export type Response = {
  /**
   * The commit that was created for the operation.
   */
  commit: GitCommit;
} & Endpoints["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]["response"];

type BranchState = {
  branch: string;
  commitSha: string;
  treeSha: string;
};

/**
 * Paths are normalized so that `"/foo/"` and `"foo"` refer to the same entry.
 */
function normalizePath(path: string, optionName: string): string {
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "");

  if (normalized === "" || normalized === ".") {
    throw new Error(
      `The "${optionName}" option must be a non-empty path relative to the repository root.`,
    );
  }

  return normalized;
}

async function getBranchState(
  octokit: Octokit,
  options: { owner: string; repo: string; branch?: string },
): Promise<BranchState> {
  const { owner, repo } = options;
  let branch = options.branch;

  if (branch === undefined) {
    // https://docs.github.com/rest/repos/repos#get-a-repository
    const { data } = await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    branch = data.default_branch;
  }

  // https://docs.github.com/rest/branches/branches#get-a-branch
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/branches/{branch}",
    { owner, repo, branch },
  );

  return {
    branch,
    commitSha: data.commit.sha,
    treeSha: data.commit.commit.tree.sha,
  };
}

async function getTreeEntries(
  octokit: Octokit,
  options: { owner: string; repo: string; treeSha: string },
): Promise<GitTreeEntry[]> {
  const { owner, repo, treeSha } = options;

  // https://docs.github.com/rest/git/trees#get-a-tree
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    { owner, repo, tree_sha: treeSha, recursive: "1" },
  );

  if (data.truncated) {
    throw new Error(
      "The repository is too large to list all of its files in a single request (the tree is truncated). Renaming and deleting paths is not supported for repositories of this size.",
    );
  }

  return data.tree;
}

function getEntry(
  entries: GitTreeEntry[],
  path: string,
  branch: string,
): GitTreeEntry {
  const entry = entries.find((entry) => entry.path === path);

  if (entry === undefined) {
    throw new Error(`The path "${path}" does not exist on branch "${branch}".`);
  }

  return entry;
}

function assertTargetAvailable(entries: GitTreeEntry[], target: string): void {
  const conflict = entries.find(
    (entry) => entry.path === target || entry.path.startsWith(`${target}/`),
  );

  if (conflict !== undefined) {
    throw new Error(
      `Cannot rename to "${target}" because "${conflict.path}" already exists.`,
    );
  }

  // An ancestor of the target must not be a file. GitHub rejects the resulting
  // tree with an opaque "GitRPC::BadObjectState" error otherwise.
  const segments = target.split("/");
  for (let index = 1; index < segments.length; index++) {
    const ancestor = segments.slice(0, index).join("/");
    const entry = entries.find((entry) => entry.path === ancestor);

    if (entry !== undefined && entry.type !== "tree") {
      throw new Error(
        `Cannot rename to "${target}" because "${ancestor}" is a file.`,
      );
    }
  }
}

function toTreeEntry(
  entry: GitTreeEntry,
  path: string,
  sha: string | null,
): TreeParameterEntry {
  // The GitHub API returns the same mode and type values that it accepts when
  // creating a tree, but the response is typed as `string`.
  return {
    path,
    mode: entry.mode as NonNullable<TreeParameterEntry["mode"]>,
    type: entry.type as NonNullable<TreeParameterEntry["type"]>,
    sha,
  };
}

async function commitChanges(
  octokit: Octokit,
  state: BranchState,
  options: CommonOptions,
  tree: TreeParameter,
): Promise<Response> {
  const { owner, repo } = options;

  // https://docs.github.com/rest/git/trees#create-a-tree
  const { data: newTree } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    { owner, repo, base_tree: state.treeSha, tree },
  );

  // https://docs.github.com/rest/git/commits#create-a-commit
  const { data: commit } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    {
      owner,
      repo,
      message: options.message,
      tree: newTree.sha,
      parents: [state.commitSha],
      ...(options.author === undefined ? {} : { author: options.author }),
      ...(options.committer === undefined
        ? {}
        : { committer: options.committer }),
    },
  );

  // https://docs.github.com/rest/git/refs#update-a-reference
  const response = await octokit.request(
    "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
    {
      owner,
      repo,
      ref: `heads/${state.branch}`,
      sha: commit.sha,
      force: false,
    },
  );

  return { ...response, commit };
}

/**
 * Rename a file, like `git mv`.
 *
 * @param octokit Octokit instance
 * @param options
 */
export async function composeRenameFile(
  octokit: Octokit,
  options: RenameOptions,
): Promise<Response> {
  const path = normalizePath(options.path, "path");
  const newPath = normalizePath(options.newPath, "newPath");

  if (path === newPath) {
    throw new Error(
      'The "path" and "newPath" options must refer to different paths.',
    );
  }

  const state = await getBranchState(octokit, options);
  const entries = await getTreeEntries(octokit, {
    owner: options.owner,
    repo: options.repo,
    treeSha: state.treeSha,
  });
  const source = getEntry(entries, path, state.branch);

  if (source.type === "tree") {
    throw new Error(
      `The path "${path}" is a directory. Use octokit.renameDirectory() instead.`,
    );
  }

  assertTargetAvailable(entries, newPath);

  return commitChanges(octokit, state, options, [
    toTreeEntry(source, newPath, source.sha),
    toTreeEntry(source, path, null),
  ]);
}

/**
 * Rename a directory and everything in it, like `git mv`.
 *
 * @param octokit Octokit instance
 * @param options
 */
export async function composeRenameDirectory(
  octokit: Octokit,
  options: RenameOptions,
): Promise<Response> {
  const path = normalizePath(options.path, "path");
  const newPath = normalizePath(options.newPath, "newPath");

  if (path === newPath) {
    throw new Error(
      'The "path" and "newPath" options must refer to different paths.',
    );
  }

  const state = await getBranchState(octokit, options);
  const entries = await getTreeEntries(octokit, {
    owner: options.owner,
    repo: options.repo,
    treeSha: state.treeSha,
  });
  const source = getEntry(entries, path, state.branch);

  if (source.type !== "tree") {
    throw new Error(
      `The path "${path}" is not a directory. Use octokit.renameFile() instead.`,
    );
  }

  if (newPath.startsWith(`${path}/`)) {
    throw new Error(
      `Cannot rename the directory "${path}" into itself ("${newPath}").`,
    );
  }

  assertTargetAvailable(entries, newPath);

  const prefix = `${path}/`;
  // Only the files need to be added at their new location. GitHub creates the
  // required directory entries implicitly from their paths.
  const additions = entries
    .filter((entry) => entry.path.startsWith(prefix) && entry.type !== "tree")
    .map((entry) =>
      toTreeEntry(
        entry,
        `${newPath}${entry.path.slice(path.length)}`,
        entry.sha,
      ),
    );

  // Deleting the directory's tree entry removes the whole subtree.
  return commitChanges(octokit, state, options, [
    ...additions,
    toTreeEntry(source, path, null),
  ]);
}

/**
 * Delete a file, like `git rm`.
 *
 * @param octokit Octokit instance
 * @param options
 */
export async function composeDeleteFile(
  octokit: Octokit,
  options: DeleteOptions,
): Promise<Response> {
  const path = normalizePath(options.path, "path");
  const state = await getBranchState(octokit, options);
  const entries = await getTreeEntries(octokit, {
    owner: options.owner,
    repo: options.repo,
    treeSha: state.treeSha,
  });
  const source = getEntry(entries, path, state.branch);

  if (source.type === "tree") {
    throw new Error(
      `The path "${path}" is a directory. Use octokit.deleteDirectory() instead.`,
    );
  }

  return commitChanges(octokit, state, options, [
    toTreeEntry(source, path, null),
  ]);
}

/**
 * Delete a directory and everything in it, like `git rm -r`.
 *
 * @param octokit Octokit instance
 * @param options
 */
export async function composeDeleteDirectory(
  octokit: Octokit,
  options: DeleteOptions,
): Promise<Response> {
  const path = normalizePath(options.path, "path");
  const state = await getBranchState(octokit, options);
  const entries = await getTreeEntries(octokit, {
    owner: options.owner,
    repo: options.repo,
    treeSha: state.treeSha,
  });
  const source = getEntry(entries, path, state.branch);

  if (source.type !== "tree") {
    throw new Error(
      `The path "${path}" is not a directory. Use octokit.deleteFile() instead.`,
    );
  }

  // Deleting the directory's tree entry removes the whole subtree.
  return commitChanges(octokit, state, options, [
    toTreeEntry(source, path, null),
  ]);
}

/**
 * High-level operations to rename and delete files and directories.
 *
 * @param octokit Octokit instance
 */
export function fileOperations(octokit: Octokit) {
  return {
    renameFile(options: RenameOptions) {
      return composeRenameFile(octokit, options);
    },
    renameDirectory(options: RenameOptions) {
      return composeRenameDirectory(octokit, options);
    },
    deleteFile(options: DeleteOptions) {
      return composeDeleteFile(octokit, options);
    },
    deleteDirectory(options: DeleteOptions) {
      return composeDeleteDirectory(octokit, options);
    },
  };
}
fileOperations.VERSION = VERSION;
