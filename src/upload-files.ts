import type { Octokit } from "@octokit/core";
import type { Endpoints } from "@octokit/types";

import { VERSION } from "./version.js";

type GitCommit =
  Endpoints["POST /repos/{owner}/{repo}/git/commits"]["response"]["data"];
type RefResponse =
  Endpoints["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]["response"];

/**
 * Information about the author or committer of a commit.
 */
export type CommitUser = {
  name: string;
  email: string;
  date?: string;
};

/**
 * Contents of a file to upload. Strings are uploaded as UTF-8. To upload
 * binary data, pass the base64-encoded contents and set `encoding` to
 * `"base64"`.
 */
export type FileContent =
  | string
  | {
      /** Contents of the file. */
      content: string;
      /** Encoding of `content`. Defaults to `"utf-8"`. */
      encoding?: "utf-8" | "base64";
    };

export type UploadFilesOptions = {
  owner: string;
  repo: string;
  /** Commit message. */
  message: string;
  /**
   * Files to create or update, keyed by their path relative to the repository
   * root. Nested directories are created as needed.
   */
  files: Record<string, FileContent>;
  /**
   * Branch to commit to. Defaults to the repository's default branch.
   */
  branch?: string;
  author?: CommitUser;
  committer?: CommitUser;
};

export type UploadFilesResponse = RefResponse & {
  /**
   * The commit that was created for the uploaded files.
   */
  commit: GitCommit;
};

type BranchState = {
  branch: string;
  commitSha: string;
  treeSha: string;
};

/**
 * Paths are normalized so that `"/foo/bar.js"` and `"foo/bar.js"` refer to the
 * same file.
 */
function normalizePath(path: string): string {
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "");

  if (normalized === "" || normalized === ".") {
    throw new Error(
      `The file path "${path}" must be a non-empty path relative to the repository root.`,
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

/**
 * Create or update multiple files in a single commit.
 *
 * GitHub's REST API can only create or update a single file per request. This
 * method uses the Git database API to upload any number of files — for example
 * the contents of a folder — in one commit.
 *
 * @param octokit Octokit instance
 * @param options
 */
export async function composeUploadFiles(
  octokit: Octokit,
  options: UploadFilesOptions,
): Promise<UploadFilesResponse> {
  const { owner, repo } = options;
  const files = Object.entries(options.files);

  if (files.length === 0) {
    throw new Error(
      'The "files" option must contain at least one file to upload.',
    );
  }

  const seenPaths = new Set<string>();
  const normalizedFiles = files.map(([path, file]) => {
    const normalizedPath = normalizePath(path);

    if (seenPaths.has(normalizedPath)) {
      throw new Error(
        `The file path "${normalizedPath}" is used more than once.`,
      );
    }
    seenPaths.add(normalizedPath);

    if (typeof file === "string") {
      return { path: normalizedPath, content: file, encoding: "utf-8" };
    }

    return {
      path: normalizedPath,
      content: file.content,
      encoding: file.encoding ?? "utf-8",
    };
  });

  const state = await getBranchState(octokit, options);

  const tree: {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }[] = [];

  for (const file of normalizedFiles) {
    // https://docs.github.com/rest/git/blobs#create-a-blob
    const { data: blob } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/blobs",
      {
        owner,
        repo,
        content: file.content,
        encoding: file.encoding,
      },
    );

    tree.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

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
 * Create or update multiple files — for example the contents of a folder — in
 * a single commit.
 *
 * @param octokit Octokit instance
 */
export function uploadFiles(octokit: Octokit) {
  return {
    uploadFiles(options: UploadFilesOptions) {
      return composeUploadFiles(octokit, options);
    },
  };
}
uploadFiles.VERSION = VERSION;
