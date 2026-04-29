import * as vscode from "vscode";
import moment from "moment";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

class Predefine {
  _workspaceRoot: string;
  _filePath: string;
  _fileWorkspaceFolder: string;
  _fileBasename: string;
  _fileExtname: string;
  _fileBasenameNoExtension: string;
  _fileDirname: string;

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

    this._workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    this._filePath = targetUri?.fsPath || "";
    this._fileWorkspaceFolder = targetFolderUri?.fsPath || "";

    if (this._filePath) {
      this._fileExtname = path.extname(this._filePath);
      this._fileBasenameNoExtension = path.basename(
        this._filePath,
        this._fileExtname
      );
      this._fileBasename = path.basename(this._filePath);
      this._fileDirname = path.dirname(this._filePath);
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
    return (
      (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0].uri.fsPath) ||
      ""
    );
  }

  public workspaceFolder() {
    return this.workspaceRoot();
  }

  public filePath(param?: string): string {
    const fullPath = this._filePath.replace(/\\/g, "/");
    const parts = fullPath.split("/").filter((p) => p.length > 0);
    return this.sliceArrayByParam(parts, param);
  }

  public fileWorkspaceFolder(param?: string): string {
    const fullPath = this._fileWorkspaceFolder.replace(/\\/g, "/");
    const parts = fullPath.split("/").filter((p) => p.length > 0);
    return this.sliceArrayByParam(parts, param);
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

  /**
   * Support for Python-style slicing, without step slicing.
   * Syntax examples:
   *
   * - ${relativeFileDirname}      -> "src/assets/images"
   * - ${relativeFileDirname|-1}   -> "images"
   * - ${relativeFileDirname|0:2}  -> "src/assets"
   * - ${relativeFileDirname|:-1}  -> "src/assets"
   */
  private sliceArrayByParam(parts: string[], param?: string): string {
    const cleanParam = param ? param.trim() : undefined;
    if (!cleanParam || parts.length === 0) return parts.join("/");

    if (cleanParam.includes(":")) {
      // handle "start:end"
      const [s, e] = cleanParam.split(":").map((item) => item.trim());
      const start = s ? parseInt(s) : 0;
      const end = e ? parseInt(e) : undefined;
      return parts.slice(start, end).join("/");
    } else {
      // handle "index"
      const index = parseInt(cleanParam);
      if (isNaN(index)) return parts.join("/");

      // support |-1|
      const result = parts.slice(index, index === -1 ? undefined : index + 1);
      return result.join("/");
    }
  }

  public relativeFileDirname(param?: string): string {
    const wsFolder = this.fileWorkspaceFolder();
    const fileDir = this.fileDirname();
    if (!wsFolder || !fileDir) return "";

    let rawRelative = path.relative(wsFolder, fileDir).replace(/\\/g, "/");
    if (rawRelative === ".") rawRelative = "";
    if (rawRelative === "") return "";

    const parts = rawRelative.split("/").filter((p) => p.length > 0);
    return this.sliceArrayByParam(parts, param);
  }

  /**
   * the name of the folder opened in VS Code without any slashes (/)
   */
  public workspaceFolderBasename(): string {
    return path.basename(this.fileWorkspaceFolder());
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

export { Predefine };
