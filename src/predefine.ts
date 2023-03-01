import * as vscode from "vscode";
import * as moment from "moment";
import * as path from "path";

class Predefine {
  _workspaceRoot: string;
  _filePath: string;
  _fileWorkspaceFolder: string;
  _fileBasename: string;
  _fileExtname: string;
  _fileBasenameNoExtension: string;
  _fileDirname: string;

  constructor() {
    let editor = vscode.window.activeTextEditor;
    let fileUri = editor && editor.document.uri;
    let fileWorkspaceFolderUri =
      fileUri && vscode.workspace.getWorkspaceFolder(fileUri);
    this._workspaceRoot =
      (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0].uri.fsPath) ||
      "";
    this._filePath = fileUri && fileUri.fsPath;
    this._fileWorkspaceFolder =
      (fileWorkspaceFolderUri && fileWorkspaceFolderUri.uri.fsPath) || "";

    if (this._filePath) {
      this._fileExtname = path.extname(this._filePath);
      this._fileBasenameNoExtension = path.basename(
        this._filePath,
        this._fileExtname
      );
      this._fileBasename = path.basename(this._filePath);
      this._fileDirname = path.dirname(this._filePath);
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

  public filePath() {
    return this._filePath;
  }

  public fileWorkspaceFolder() {
    return this._fileWorkspaceFolder;
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
   * the current opened file's dirname relative to `$fileWorkspaceFolder`
   */
  public relativeFileDirname(): string {
    return path.relative(this.fileWorkspaceFolder(), this.fileDirname());
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
}

export { Predefine };
