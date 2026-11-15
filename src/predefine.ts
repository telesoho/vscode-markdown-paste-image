import * as vscode from "vscode";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { PathSpace, getPathSpace, implFor, toDisplayPath } from "./path_space";

class Predefine {
  _workspaceRoot: string;
  _filePath: string;
  _fileWorkspaceFolder: string;
  _fileBasename: string;
  _fileExtname: string;
  _fileBasenameNoExtension: string;
  _fileDirname: string;
  _space: PathSpace;

  constructor(fileUri?: vscode.Uri, workspaceFolderUri?: vscode.Uri) {
    // prioritize using the passed‑in fileUri; if none is provided, then fall back to the currently active editor (the original logic).
    let editor = vscode.window.activeTextEditor;
    const targetUri = fileUri ?? editor?.document.uri;

    const targetFolderUri =
      workspaceFolderUri ??
      (targetUri
        ? vscode.workspace.getWorkspaceFolder(targetUri)?.uri
        : undefined) ??
      vscode.workspace.workspaceFolders?.[0]?.uri;

    // All path computations happen in the dialect of the document's file
    // system, so remote paths stay POSIX instead of being translated into
    // local Windows paths by `uri.fsPath`.
    this._space = getPathSpace(
      targetUri ??
        targetFolderUri ??
        vscode.workspace.workspaceFolders?.[0]?.uri ??
        vscode.Uri.file("")
    );
    const impl = implFor(this._space);
    this._workspaceRoot = targetFolderUri
      ? toDisplayPath(targetFolderUri, getPathSpace(targetFolderUri))
      : "";
    this._filePath = targetUri ? toDisplayPath(targetUri, this._space) : "";
    this._fileWorkspaceFolder = targetFolderUri
      ? toDisplayPath(targetFolderUri, getPathSpace(targetFolderUri))
      : "";

    if (this._filePath) {
      this._fileExtname = impl.extname(this._filePath);
      this._fileBasenameNoExtension = impl.basename(
        this._filePath,
        this._fileExtname
      );
      this._fileBasename = impl.basename(this._filePath);
      this._fileDirname = impl.dirname(this._filePath);
    } else {
      this._fileExtname = "";
      this._fileBasenameNoExtension = "";
      this._fileBasename = "";
      this._fileDirname = "";
    }
  }

  public datetime(dateformat: string = "yyyyMMDDHHmmss") {
    return moment().format(dateformat);
  }

  public workspaceRoot() {
    return this._workspaceRoot || "";
  }

  public workspaceFolder() {
    return this.workspaceRoot();
  }

  public filePath(param?: string): string {
    if (!param) {
      return this._filePath;
    }
    return this.getSlicedPath(this._filePath, param);
  }

  public fileWorkspaceFolder(param?: string): string {
    if (!param) {
      return this._fileWorkspaceFolder;
    }
    return this.getSlicedPath(this._fileWorkspaceFolder, param);
  }

  public fileBasename(): string {
    return this._fileBasename;
  }

  public fileExtname(): string {
    return this._fileExtname;
  }

  public fileBasenameNoExtension(): string {
    return this._fileBasenameNoExtension;
  }
  public fileDirname(): string {
    return this._fileDirname;
  }
  private getSlicedPath(inputPath: string, param: string): string {
    // Slicing works on the display form: forward slashes only, whatever the
    // platform or the file system provider.
    const normalized = inputPath.replace(/\\/g, "/");
    const { root, rest } = splitDisplayRoot(normalized);
    const parts = root
      ? [root, ...rest.split("/").filter(Boolean)]
      : rest.split("/").filter(Boolean);
    const slicedParts = this.getArraySlice(parts, param);
    return implFor(this._space)
      .join(...slicedParts)
      .replace(/\\/g, "/");
  }

  /**
   * Support for Python-style slicing, without step slicing.
   * Syntax examples:
   *
   * - ${relativeFileDirname}      -> "src/assets/images"
   * - ${relativeFileDirname|-1}   -> "images"
   * - ${relativeFileDirname|0:2}  -> "src/assets"
   * - ${relativeFileDirname|:-1}  -> "src/assets"
   */
  private getArraySlice<T>(items: T[], param: string): T[] {
    if (!param || items.length === 0) return items;

    const cleanParam = param.trim();
    if (!cleanParam) return items;

    if (cleanParam.includes(":")) {
      // "start:end"
      const [s, e] = cleanParam.split(":").map((p) => p.trim());
      const start = s ? parseInt(s) : 0;
      const end = e ? parseInt(e) : undefined;
      return items.slice(start, end);
    }

    // "index"
    const index = parseInt(cleanParam);
    if (isNaN(index)) return items;

    return items.slice(index, index === -1 ? undefined : index + 1);
  }

  public relativeFileDirname(param?: string): string {
    const wsFolder = this.fileWorkspaceFolder();
    const fileDir = this.fileDirname();
    if (!wsFolder || !fileDir) return "";

    let rawRelative = implFor(this._space)
      .relative(wsFolder, fileDir)
      .replace(/\\/g, "/");
    if (rawRelative === ".") rawRelative = "";
    if (rawRelative === "") return "";
    if (!param) return rawRelative;

    return this.getSlicedPath(rawRelative, param);
  }

  /**
   * the name of the folder opened in VS Code without any slashes (/)
   */
  public workspaceFolderBasename(): string {
    return implFor(this._space).basename(this.fileWorkspaceFolder());
  }
  /**
   * the current opened file
   */
  public file(): string {
    return this.filePath();
  }

  /**
   * a random UUID v4
   */
  public uuid(): string {
    return uuidv4();
  }

  /**
   * Get current selected text.
   * @param defaultText
   * @returns
   *  string: selected text
   *  defaultText : if selected text contain illegal characters or empty
   */
  public selectedText(defaultText: string = ""): string {
    const selection = vscode.window.activeTextEditor.selection;
    const selectText =
      vscode.window.activeTextEditor.document.getText(selection);

    if (selectText && !/^[^\\/:\*\?""<>|\r\n]*$/.test(selectText)) {
      vscode.window.showInformationMessage(
        "The selected text contains illegal characters that cannot be used as a file name!"
      );
      return defaultText;
    } else if (selectText.trim() == "") {
      return defaultText;
    }

    return selectText;
  }

  /**
   * Replace all predefined variable.
   * @param str path
   * @returns
   */
  static replacePredefinedVars(str: string) {
    let predefine = new Predefine();
    return Predefine.replaceRegPredefinedVars(str, predefine);
  }

  /**
   * Replace all predefined variable with Regexp.
   * @param str path
   * @returns
   */
  static replaceRegPredefinedVars(str: string, predefine: Predefine) {
    const regex = /(?<var>\$\{\s*(?<name>\w+)\s*(\|(?<param>.*?))?\})/gm;

    let ret: string = str;
    let m: RegExpExecArray;

    while ((m = regex.exec(str)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      if (m.groups.name in predefine) {
        ret = ret.replace(
          m.groups.var,
          predefine[m.groups.name](m.groups.param)
        );
      }
    }

    // User may be input a path with backward slashes (\), so need to replace all '\' to '/'.
    return ret.replace(/\\/g, "/");
  }
}

/**
 * Split a display path into its root and the remainder, for slicing.
 * Handles POSIX roots (`/`), Windows drives (`C:/`) and UNC shares
 * (`//server/share/`).
 */
function splitDisplayRoot(p: string): { root: string; rest: string } {
  const drive = /^[a-zA-Z]:\//.exec(p);
  if (drive) return { root: p.slice(0, drive[0].length), rest: p.slice(3) };
  if (p.startsWith("//")) {
    const unc = /^\/\/[^/]+\/[^/]+\/?/.exec(p);
    if (unc) return { root: unc[0], rest: p.slice(unc[0].length) };
  }
  if (p.startsWith("/")) return { root: "/", rest: p.slice(1) };
  return { root: "", rest: p };
}

export { Predefine };
