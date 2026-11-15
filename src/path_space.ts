import * as path from "path";
import * as vscode from "vscode";

/**
 * The "dialect" used to compute paths for a resource.
 *
 * - `win32`: native Windows paths (drive letters, UNC shares). Only used for
 *   `file:` resources while the extension host runs on Windows.
 * - `posix`: POSIX paths. Used for every non-`file:` scheme (remote windows are
 *   addressed as `/c:/foo/bar` by their file system provider) and for `file:`
 *   resources on macOS/Linux.
 */
export type PathSpace = "posix" | "win32";

/**
 * A target file expressed both as a {@link vscode.Uri} (the only thing that can
 * be written to) and as a display path (the string shown in the input box).
 */
export interface TargetPath {
  uri: vscode.Uri;
  display: string;
}

/**
 * Pick the path dialect for a resource.
 *
 * Remote resources always use POSIX semantics: the URI path is what the file
 * system provider understands, and `uri.fsPath` on a UI-hosted extension is a
 * local, meaningless translation (e.g. `/home/u/x.png` -> `\home\u\x.png`).
 */
export function getPathSpace(uri: vscode.Uri): PathSpace {
  if (uri.scheme === "file") {
    return process.platform === "win32" ? "win32" : "posix";
  }
  return "posix";
}

/**
 * Get the `path` module flavour matching a space.
 */
export function implFor(space: PathSpace): typeof path.posix {
  // `path.win32` and `path.posix` share the same surface.
  return space === "win32" ? path.win32 : (path.posix as typeof path.win32);
}

/**
 * Convert a resource to the canonical string form used everywhere inside the
 * extension: decoded, forward slashes only.
 *
 * - local Windows: `C:/Users/me/docs/a.md`
 * - remote / POSIX: `/home/me/proj/a.md`
 */
export function toDisplayPath(
  uri: vscode.Uri,
  space: PathSpace = getPathSpace(uri)
): string {
  const raw = space === "win32" ? uri.fsPath : uri.path;
  // Keep the drive letter casing from the input (`uri.fsPath` lower-cases it,
  // but users and rules may expect their original casing).
  return normalizeDisplay(raw, space);
}

/**
 * Normalize a path string to forward slashes and collapse `..`/`.`.
 */
export function normalizeDisplay(p: string, space: PathSpace): string {
  if (!p) return p;
  const impl = implFor(space);
  return impl.normalize(p).replace(/\\/g, "/");
}

/**
 * Resolve a path (absolute or relative to `baseDir`) into a normalized display
 * path of the given space.
 */
export function resolveDisplayPath(
  baseDir: string,
  space: PathSpace,
  p: string
): string {
  const impl = implFor(space);
  const trimmed = (p || "").replace(/\\/g, "/");
  if (!trimmed) return normalizeDisplay(baseDir, space);
  if (impl.isAbsolute(trimmed)) return normalizeDisplay(trimmed, space);
  return normalizeDisplay(impl.resolve(baseDir, trimmed), space);
}

/**
 * Remove the query and fragment of a URI. Remote notebook cells carry a
 * fragment (`#W0sZmlsZQ%3D%3D`) and the width/height suffix is a query
 * (`?100,60`); neither belongs to the file that gets written.
 */
export function stripQueryAndFragment(uri: vscode.Uri): vscode.Uri {
  if (!uri.query && !uri.fragment) return uri;
  return uri.with({ query: "", fragment: "" });
}

/**
 * Turn an absolute display path into a URI that lives in the same file system
 * as `docUri` (same scheme and, for remotes, same authority).
 *
 * @param docUri resource of the document being edited
 * @param display absolute path in the display form of the document's space
 */
export function fromDisplayPath(
  docUri: vscode.Uri,
  display: string
): vscode.Uri {
  const d = display.replace(/\\/g, "/");
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(d);

  if (hasScheme) {
    return stripQueryAndFragment(vscode.Uri.parse(d));
  }

  if (docUri.scheme === "file") {
    if (/^[a-zA-Z]:\//.test(d)) {
      return stripQueryAndFragment(vscode.Uri.parse("file:///" + d));
    }
    if (d.startsWith("//")) {
      return stripQueryAndFragment(vscode.Uri.parse("file:" + d));
    }
    return stripQueryAndFragment(vscode.Uri.file(d));
  }

  // Remote: keep scheme + authority, replace the path.
  return docUri.with({
    path: d.startsWith("/") ? d : "/" + d,
    query: "",
    fragment: "",
  });
}

/**
 * True when the resource lives on a remote file system (SSH, WSL, container,
 * Codespaces, tunnel, ...).
 */
export function isRemoteUri(uri: vscode.Uri): boolean {
  return uri.scheme !== "file";
}

/**
 * Translate a `vscode-remote://wsl+<distro>/...` file into UNC paths that the
 * local Windows clipboard helper can write to directly, newest syntax first.
 *
 * Returns an empty array when the resource is not a WSL remote, so callers can
 * treat "no candidates" as "use the generic transfer path".
 */
export function wslUncCandidates(
  authority: string | undefined,
  posixPath: string
): string[] {
  if (process.platform !== "win32") return [];
  if (!authority || !authority.startsWith("wsl+")) return [];
  const distro = authority.slice("wsl+".length);
  if (!distro || !posixPath || !posixPath.startsWith("/")) return [];
  const tail = posixPath.replace(/\//g, "\\");
  return [`\\\\wsl.localhost\\${distro}${tail}`, `\\\\wsl$\\${distro}${tail}`];
}

/**
 * Generate the display path of the directory containing `uri`.
 */
export function dirnameOf(uri: vscode.Uri, space?: PathSpace): string {
  const s = space ?? getPathSpace(uri);
  return implFor(s).dirname(toDisplayPath(uri, s));
}

/**
 * The URI of the directory containing `uri`, in the same file system.
 */
export function parentUri(uri: vscode.Uri): vscode.Uri {
  return fromDisplayPath(uri, dirnameOf(uri));
}

/**
 * Last segment of a display path.
 */
export function basenameOf(display: string): string {
  const trimmed = display.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index < 0 ? trimmed : trimmed.slice(index + 1);
}

/**
 * True when the string starts with an explicit `scheme://`.
 */
export function hasExplicitScheme(p: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p);
}
