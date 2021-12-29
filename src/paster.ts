import * as path from "path";
import * as clipboard from "clipboardy";
import { spawn } from "child_process";
import * as moment from "moment";
import * as vscode from "vscode";
import { toMarkdown } from "./toMarkdown";
import {
  prepareDirForFile,
  fetchAndSaveFile,
  newTemporaryFilename,
  base64Encode,
  getCurrentPlatform,
  Platform,
} from "./utils";
import { existsSync, rmSync, RmOptions } from "fs";
import { LanguageDetection } from "./language_detection";
import Logger from "./Logger";

enum ClipboardType {
  Unknown = -1,
  Html = 0,
  Text,
  Image,
}

class PasteImageContext {
  targetFile?: vscode.Uri;
  convertToBase64: boolean;
  removeTargetFileAfterConvert: boolean;
  imgTag?: {
    width: string;
    height: string;
  } | null;
}

async function wslSafe(path: string) {
  if (getCurrentPlatform() != "wsl") return path;
  await runCommand("touch", [path]);
  return runCommand("wslpath", ["-m", path]);
}

/**
 * Run command and get stdout
 * @param shell
 * @param options
 */
function runCommand(
  shell,
  options: string[],
  timeout = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let errorTriggered = false;
    let output = "";
    let errorMessage = "";
    let process = spawn(shell, options, { timeout });

    process.stdout.on(
      "data",
      (chunk) => {
        Logger.log(chunk);
        output += `${chunk}`;
      });

    process.stderr.on(
      "data",
      (chunk) => {
        Logger.log(chunk);
        errorMessage += `${chunk}`;
      });

    process.on(
      "exit",
      (code, signal) => {
        Logger.log(`Process exited w/ code ${code}`);
        if (process.killed) {
          Logger.log("Process took too long and was killed");
        }

        if (!errorTriggered) {
          if (code === 0) {
            resolve(output);
          } else {
            reject(errorMessage);
          }
        }
      });

    process.on(
      "error",
      (error) => {
        errorTriggered = true;
        reject(error);
      });
  });
}

class Paster {
  public static async pasteCode() {
    const content = clipboard.readSync();
    if (content) {
      let ld = new LanguageDetection();
      let lang = await ld.detectLanguage(content);
      Paster.writeToEditor(`\`\`\`${lang}\n${content}\n\`\`\``);
    }
  }

  /**
   * Paste text
   */
  public static async pasteText() {
    const ctx_type = await this.getClipboardContentType();

    Logger.log("Clipboard Type:", ctx_type);
    switch (ctx_type) {
      case ClipboardType.Html:
        const html = await this.pasteTextHtml();
        Logger.log(html);
        const markdown = toMarkdown(html);
        Paster.writeToEditor(markdown);
        break;
      case ClipboardType.Text:
        const text = await this.pasteTextPlain();
        if (text) {
          let newContent = Paster.parse(text);
          Paster.writeToEditor(newContent);
        }
        break;
      case ClipboardType.Image:
        Paster.pasteImage();
        break;
      case ClipboardType.Unknown:
        // Probably missing script to support type detection
        const textContent = clipboard.readSync();
        // If clipboard has text, paste it
        if (textContent) {
          Paster.writeToEditor(textContent);
        } else {
          // No text in clipboard, attempt to paste image
          Paster.pasteImage();
        }
        break;
    }
  }

  /**
   * Download url content in clipboard
   */
  public static async pasteDownload() {
    const ctx_type = await this.getClipboardContentType();
    Logger.log("Clipboard Type:", ctx_type);
    switch (ctx_type) {
      case ClipboardType.Html:
      case ClipboardType.Text:
        const text = await this.pasteTextPlain();
        if (text) {
          if (/^(http[s]:)+\/\/(.*)/i.test(text)) {
            Paster.pasteImageURL(text);
          }
        }
        break;
    }
  }
  /**
   * Ruby tag
   */
  public static Ruby() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;
    let rubyTag = new vscode.SnippetString(
      "<ruby>${TM_SELECTED_TEXT}<rp>(</rp><rt>${1:pronunciation}</rt><rp>)</rp></ruby>"
    );
    editor.insertSnippet(rubyTag);
  }

  private static isHTML(content) {
    return /<[a-z][\s\S]*>/i.test(content);
  }

  private static writeToEditor(content): Thenable<boolean> {
    let startLine = vscode.window.activeTextEditor.selection.start.line;
    const selection = vscode.window.activeTextEditor.selection;
    let position = new vscode.Position(startLine, selection.start.character);
    return vscode.window.activeTextEditor.edit((editBuilder) => {
      editBuilder.insert(position, content);
    });
  }

  /**
   * Replace all predefined variable.
   * @param str path
   * @returns
   */
  private static replacePredefinedVars(str) {
    let replaceMap = {
      "${workspaceRoot}":
        (vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders[0].uri.fsPath) ||
        "",
    };

    let editor = vscode.window.activeTextEditor;
    let fileUri = editor && editor.document.uri;
    let filePath = fileUri && fileUri.fsPath;

    if (filePath) {
      replaceMap["${fileExtname}"] = path.extname(filePath);
      replaceMap["${fileBasenameNoExtension}"] = path.basename(
        filePath,
        replaceMap["${fileExtname}"]
      );
      replaceMap["${fileBasename}"] = path.basename(filePath);
      replaceMap["${fileDirname}"] = path.dirname(filePath);
    }

    for (const search in replaceMap) {
      str = str.replace(search, replaceMap[search]);
    }

    // User may be input a path with backward slashes (\), so need to replace all '\' to '/'.
    return str.replace(/\\/g, "/");
  }

  /**
   * Generate different Markdown content based on the value entered.
   * for example:
   * ./assets/test.png        => ![](./assets/test.png)
   * ./assets/test.png?200,10 => <img src="./assets/test.png" width="200" height="10"/>
   * ./assets/                => ![](![](data:image/png;base64,...)
   * ./assets/?200,10         => <img src="data:image/png;base64,..." width="200" height="10"/>
   *
   * @param inputVal
   * @returns
   */
  protected static parsePasteImageContext(inputVal: string): PasteImageContext {
    if (!inputVal) return;

    inputVal = this.replacePredefinedVars(inputVal);

    //leading and trailling white space are invalidate
    if (inputVal && inputVal.length !== inputVal.trim().length) {
      vscode.window.showErrorMessage(
        'The specified path is invalid: "' + inputVal + '"'
      );
      return;
    }

    // ! Maybe it is a bug in vscode.Uri.parse():
    // > vscode.Uri.parse("f:/test/images").fsPath
    // '/test/images'
    // > vscode.Uri.parse("file:///f:/test/images").fsPath
    // 'f:/test/image'
    //
    // So we have to add file:/// scheme. while input value contain a driver character
    if (inputVal.substr(1, 1) === ":") {
      inputVal = "file:///" + inputVal;
    }

    let pasteImgContext = new PasteImageContext();

    let inputUri = vscode.Uri.parse(inputVal);

    if (inputUri.fsPath.slice(inputUri.fsPath.length - 1) == "/") {
      // While filename is empty(ex: /abc/?200,20),  paste clipboard to a temporay file, then convert it to base64 image to markdown.
      pasteImgContext.targetFile = newTemporaryFilename();
      pasteImgContext.convertToBase64 = true;
      pasteImgContext.removeTargetFileAfterConvert = true;
    } else {
      pasteImgContext.targetFile = inputUri;
      pasteImgContext.convertToBase64 = false;
      pasteImgContext.removeTargetFileAfterConvert = false;
    }

    let enableImgTagConfig =
      vscode.workspace.getConfiguration("MarkdownPaste").enableImgTag;
    if (enableImgTagConfig && inputUri.query) {
      // parse `<filepath>[?width,height]`. for example. /abc/abc.png?200,100
      let ar = inputUri.query.split(",");
      if (ar) {
        pasteImgContext.imgTag = {
          width: ar[0],
          height: ar[1],
        };
      }
    }

    return pasteImgContext;
  }

  protected static async saveImage(targetPath: string) {
    let pasteImgContext = this.parsePasteImageContext(targetPath);
    if (!pasteImgContext || !pasteImgContext.targetFile) return;

    let imgPath = pasteImgContext.targetFile.fsPath;

    if (!prepareDirForFile(imgPath)) {
      vscode.window.showErrorMessage("Make folder failed:" + imgPath);
      return;
    }

    // save image and insert to current edit file
    const imagePath = await this.saveClipboardImageToFileAndGetPath(imgPath);
    if (!imagePath) return;
    if (imagePath === "no image") {
      vscode.window.showInformationMessage(
        "There is not an image in the clipboard."
      );
      return;
    }

    this.renderMarkdownLink(pasteImgContext);
  }

  private static renderMdFilePath(pasteImgContext: PasteImageContext): string {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let fileUri = editor.document.uri;
    if (!fileUri) return;

    let languageId = editor.document.languageId;

    let docPath = fileUri.fsPath;

    // relative will be add backslash characters so need to replace '\' to '/' here.
    let imageFilePath = this.parse(
      this.encodePath(
        path.relative(path.dirname(docPath), pasteImgContext.targetFile.fsPath)
      )
    );

    //"../../static/images/vscode-paste/cover.png".replace(new RegExp("(.*/static/)(.*)", ""), "/$2")
    if (languageId === "markdown") {
      let imgTag = pasteImgContext.imgTag;
      if (imgTag) {
        return `<img src='${imageFilePath}' width='${imgTag.width}' height='${imgTag.height}'/>`;
      }
      return `![](${imageFilePath})`;
    } else {
      return imageFilePath;
    }
  }

  private static renderMdImageBase64(
    pasteImgContext: PasteImageContext
  ): string {
    if (
      !pasteImgContext.targetFile.fsPath ||
      !existsSync(pasteImgContext.targetFile.fsPath)
    ) {
      return;
    }

    let renderText = base64Encode(pasteImgContext.targetFile.fsPath);
    let imgTag = pasteImgContext.imgTag;
    if (imgTag) {
      renderText = `<img src='data:image/png;base64,${renderText}' width='${imgTag.width}' height='${imgTag.height}'/>`;
    } else {
      renderText = `![](data:image/png;base64,${renderText})`;
    }

    const rmOptions: RmOptions = {
      recursive: true,
      force: true,
    };

    if (pasteImgContext.removeTargetFileAfterConvert) {
      rmSync(pasteImgContext.targetFile.fsPath, rmOptions);
    }

    return renderText;
  }

  public static renderMarkdownLink(pasteImgContext: PasteImageContext) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let renderText: string;
    if (pasteImgContext.convertToBase64) {
      renderText = this.renderMdImageBase64(pasteImgContext);
    } else {
      renderText = this.renderMdFilePath(pasteImgContext);
    }

    if (renderText) {
      editor.edit((edit) => {
        let current = editor.selection;
        if (current.isEmpty) {
          edit.insert(current.start, renderText);
        } else {
          edit.replace(current, renderText);
        }
      });
    }
  }

  /**
   * Encode path string.
   * encodeURI        : encode all characters to URL encode format
   * encodeSpaceOnly  : encode all space character to %20
   * none             : do nothing
   * @param filePath
   * @returns
   */
  private static encodePath(filePath: string) {
    filePath = filePath.replace(/\\/g, "/");

    const encodePathConfig =
      vscode.workspace.getConfiguration("MarkdownPaste")["encodePath"];

    if (encodePathConfig == "encodeURI") {
      filePath = encodeURI(filePath);
    } else if (encodePathConfig == "encodeSpaceOnly") {
      filePath = filePath.replace(/ /g, "%20");
    }
    return filePath;
  }

  private static parse(content) {
    let rules = vscode.workspace.getConfiguration("MarkdownPaste").rules;
    for (const rule of rules) {
      const re = new RegExp(rule.regex, rule.options);
      const reps = rule.replace;
      if (re.test(content)) {
        const newstr = content.replace(re, reps);
        return newstr;
      }
    }

    try {
      // if copied content is exist file path that under folder of workspace root path
      // then add a relative link into markdown.
      if (existsSync(content)) {
        let editor = vscode.window.activeTextEditor;
        let fileUri = editor.document.uri;
        let current_file_path = fileUri.fsPath;
        let workspace_root_dir =
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders[0].uri.path;

        if (content.startsWith(workspace_root_dir)) {
          let relative_path = this.encodePath(
            path.relative(path.dirname(current_file_path), content)
          );

          return `![](${relative_path})`;
        }
      }
    } catch (error) {
      // do nothing
      // Logger.log(error);
    }

    if (Paster.isHTML(content)) {
      return toMarkdown(content);
    }

    return content;
  }

  private static async pasteTextPlain() {
    const script = {
      win32: "win32_get_clipboard_text_plain.ps1",
      linux: "linux_get_clipboard_text_plain.sh",
      darwin: null,
      wsl: "win32_get_clipboard_text_plain.ps1",
      win10: "win32_get_clipboard_text_plain.ps1",
    };

    return this.runScript(script, []);
  }

  private static async pasteTextHtml() {
    const script = {
      win32: "win32_get_clipboard_text_html.ps1",
      linux: "linux_get_clipboard_text_html.sh",
      darwin: null,
      wsl: "win32_get_clipboard_text_html.ps1",
      win10: "win32_get_clipboard_text_html.ps1",
    };
    return this.runScript(script, []);
  }

  /**
   * Download image to local and render markdown link for it.
   * @param image_url
   */
  private static pasteImageURL(image_url) {
    let filename = image_url.split("/").pop().split("?")[0];
    let ext = path.extname(filename);
    let imagePath = this.genTargetImagePath(ext);
    if (!imagePath) return;

    let silence = vscode.workspace.getConfiguration("MarkdownPaste").silence;
    if (silence) {
      Paster.downloadFile(image_url, imagePath);
    } else {
      let options: vscode.InputBoxOptions = {
        prompt:
          "You can change the filename. The existing file will be overwritten!",
        value: imagePath,
        placeHolder: "(e.g:../test/myimg.png?100,60)",
        valueSelection: [
          imagePath.length - path.basename(imagePath).length,
          imagePath.length - ext.length,
        ],
      };
      vscode.window.showInputBox(options).then((inputVal) => {
        Paster.downloadFile(image_url, inputVal);
      });
    }
  }

  private static downloadFile(image_url: string, target: string) {
    let pasteImgContext = this.parsePasteImageContext(target);

    if (!pasteImgContext || !pasteImgContext.targetFile) return;

    let imgPath = pasteImgContext.targetFile.fsPath;
    if (!prepareDirForFile(imgPath)) {
      vscode.window.showErrorMessage("Make folder failed:" + imgPath);
      return;
    }

    // save image and insert to current edit file
    fetchAndSaveFile(image_url, imgPath)
      .then((imagePath: string) => {
        if (!imagePath) return;
        if (imagePath === "no image") {
          vscode.window.showInformationMessage(
            "There is not an image in the clipboard."
          );
          return;
        }
        this.renderMarkdownLink(pasteImgContext);
      })
      .catch((err) => {
        vscode.window.showErrorMessage("Download failed:" + err);
      });
  }

  /**
   * Paste clipboard of image to file and render Markdown link for it.
   * @returns
   */
  private static pasteImage() {
    let ext = ".png";
    let imagePath = this.genTargetImagePath(ext);
    if (!imagePath) return;

    let silence = vscode.workspace.getConfiguration("MarkdownPaste").silence;

    if (silence) {
      Paster.saveImage(imagePath);
    } else {
      let options: vscode.InputBoxOptions = {
        prompt:
          "You can change the filename. The existing file will be overwritten!.",
        value: imagePath,
        placeHolder: "(e.g:../test/myimage.png?100,60)",
        valueSelection: [
          imagePath.length - path.basename(imagePath).length,
          imagePath.length - ext.length,
        ],
      };
      vscode.window.showInputBox(options).then((inputVal) => {
        Paster.saveImage(inputVal);
      });
    }
  }

  /**
   * Generate an path for target image.
   * @param extension extension of target image file.
   * @returns
   */
  private static genTargetImagePath(extension: string = ".png"): string {
    // get current edit file path
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let fileUri = editor.document.uri;
    if (!fileUri) return;
    if (fileUri.scheme === "untitled") {
      vscode.window.showInformationMessage(
        "Before pasting an image, you need to save the current edited file first."
      );
      return;
    }

    let filePath = fileUri.fsPath;
    // get selection as image file name, need check
    const selection = editor.selection;
    const selectText = editor.document.getText(selection);

    if (selectText && !/^[^\\/:\*\?""<>|]{1,120}$/.test(selectText)) {
      vscode.window.showInformationMessage(
        "Your selection is not a valid file name!"
      );
      return;
    }

    // get image destination path
    let folderPathFromConfig =
      vscode.workspace.getConfiguration("MarkdownPaste").path;

    folderPathFromConfig = this.replacePredefinedVars(folderPathFromConfig);

    if (
      folderPathFromConfig &&
      folderPathFromConfig.length !== folderPathFromConfig.trim().length
    ) {
      vscode.window.showErrorMessage(
        'The specified path is invalid: "' + folderPathFromConfig + '"'
      );
      return;
    }

    // image file name
    let imageFileName = "";
    if (!selectText) {
      imageFileName = moment().format("Y-MM-DD-HH-mm-ss") + extension;
    } else {
      imageFileName = selectText + extension;
    }

    // image output path
    let folderPath = path.dirname(filePath);
    let imagePath = "";

    // generate image path
    if (path.isAbsolute(folderPathFromConfig)) {
      // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
      imagePath = path
        .join(folderPathFromConfig, imageFileName)
        .replace(/\\/g, "/");
    } else {
      // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
      imagePath = path
        .join(folderPath, folderPathFromConfig, imageFileName)
        .replace(/\\/g, "/");
    }

    return imagePath;
  }

  private static getClipboardType(types) {
    if (!types) {
      return ClipboardType.Unknown;
    }

    const detectedTypes = new Set();
    let platform = getCurrentPlatform();
    Logger.log("platform", platform);
    switch (platform) {
      case "linux":
        for (const type of types) {
          switch (type) {
            case "image/png":
              detectedTypes.add(ClipboardType.Image);
              break;
            case "text/html":
              detectedTypes.add(ClipboardType.Html);
              break;
            default:
              detectedTypes.add(ClipboardType.Text);
              break;
          }
        }
        break;
      case "win32":
      case "win10":
      case "wsl":
        for (const type of types) {
          switch (type) {
            case "PNG":
            case "Bitmap":
            case "DeviceIndependentBitmap":
              detectedTypes.add(ClipboardType.Image);
              break;
            case "HTML Format":
              detectedTypes.add(ClipboardType.Html);
              break;
            case "Text":
            case "UnicodeText":
              detectedTypes.add(ClipboardType.Text);
              break;
          }
        }
        break;
    }

    // Set priority based on which to return type
    const priorityOrdering = [
      ClipboardType.Image,
      ClipboardType.Html,
      ClipboardType.Text,
    ];
    for (const type of priorityOrdering)
      if (detectedTypes.has(type)) return type;
    // No known types detected
    return ClipboardType.Unknown;
  }

  private static async getClipboardContentType() {
    const script = {
      linux: "linux_get_clipboard_content_type.sh",
      win32: "win32_get_clipboard_content_type.ps1",
      darwin: null,
      wsl: "win32_get_clipboard_content_type.ps1",
      win10: "win32_get_clipboard_content_type.ps1",
    };

    try {
      let data = await this.runScript(script, []);
      Logger.log("getClipboardContentType", data);
      if (data == "no xclip") {
        vscode.window.showInformationMessage(
          "You need to install xclip command first."
        );
        return;
      }
      let types = data.split(/\r\n|\n|\r/);

      return this.getClipboardType(types);
    } catch (e) {
      return ClipboardType.Unknown;
    }
  }

  /**
   * Run shell script.
   * @param script
   * @param parameters
   * @param callback
   */
  private static async runScript(
    script: Record<Platform, string | null>,
    parameters = []
  ) {
    let platform = getCurrentPlatform();
    if (script[platform] == null) {
      Logger.log(`No scipt exists for ${platform}`);
      throw new Error(`No scipt exists for ${platform}`);
    }
    const scriptPath = path.join(__dirname, "../res/" + script[platform]);
    let shell = "";
    let command = [];

    switch (platform) {
      case "win32":
      case "win10":
      case "wsl":
        // Windows
        command = [
          "-noprofile",
          "-noninteractive",
          "-nologo",
          "-sta",
          "-executionpolicy",
          "unrestricted",
          "-windowstyle",
          "hidden",
          "-file",
          await wslSafe(scriptPath),
        ].concat(parameters);
        shell =
          platform == "wsl"
            ? "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
            : "powershell";
        break;
      case "darwin":
        // Mac
        shell = "osascript";
        command = [scriptPath].concat(parameters);
        break;
      case "linux":
        // Linux
        shell = "sh";
        command = [scriptPath].concat(parameters);
        break;
    }

    const runer = runCommand(shell, command);

    return runer.then((stdout) => stdout.trim());
  }

  /**
   * use applescript to save image from clipboard and get file path
   */
  private static async saveClipboardImageToFileAndGetPath(imagePath) {
    if (!imagePath) return;

    const script = {
      win32: "win32_save_clipboard_png.ps1",
      darwin: "mac.applescript",
      linux: "linux_save_clipboard_png.sh",
      wsl: "win32_save_clipboard_png.ps1",
      win10: "win32_save_clipboard_png.ps1",
    };

    return this.runScript(script, [await wslSafe(imagePath)]);
  }
}

export { Paster };
