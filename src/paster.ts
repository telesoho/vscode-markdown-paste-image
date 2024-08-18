import * as path from "path";
import * as vscode from "vscode";
import * as xclip from "xclip";
import { toMarkdown } from "./toMarkdown";
import { Predefine } from "./predefine";
import { AIPaster } from "./ai_paster";
import {
  prepareDirForFile,
  fetchAndSaveFile,
  newTemporaryFilename,
  base64Encode,
} from "./utils";
import { existsSync, rmSync, RmOptions } from "fs";
import { LanguageDetection } from "./language_detection";
import Logger from "./Logger";

class PasteImageContext {
  targetFile?: vscode.Uri;
  convertToBase64: boolean;
  removeTargetFileAfterConvert: boolean;
  imgTag?: {
    width: string;
    height: string;
  } | null;
}

class Paster {
  public static async pasteCode() {
    const shell = xclip.getShell();
    const cb = shell.getClipboard();
    const content = await cb.getTextPlain();
    if (content) {
      let ld = new LanguageDetection();
      let lang = await ld.detectLanguage(content);
      Paster.writeToEditor(`\`\`\`${lang}\n${content}\n\`\`\``);
    }
  }

  static async parseByAI(content: string): Promise<Boolean> {
    if (Paster.getConfig().enableAI) {
      const p = new AIPaster();
      const result = await p.callAI(content);
      if (result["status"] == "success") {
        let newContent = result["data"];
        Logger.log(newContent);
        Paster.writeToEditor(newContent);
        return true;
      }
    }
    return false;
  }

  /**
   * Paste text
   */
  public static async pasteText() {
    const shell = xclip.getShell();
    const cb = shell.getClipboard();
    const ctx_type = await cb.getContentType();

    let enableHtmlConverter = Paster.getConfig().enableHtmlConverter;
    let enableRulesForHtml = Paster.getConfig().enableRulesForHtml;
    let turndownOptions = Paster.getConfig().turndownOptions;

    Logger.log("Clipboard Type:", ctx_type);
    switch (ctx_type) {
      case xclip.ClipboardType.Html:
        if (enableHtmlConverter) {
          const html = await cb.getTextHtml();
          if (await Paster.parseByAI(html)) {
            return;
          }
          Logger.log(html);
          const markdown = toMarkdown(html, turndownOptions);
          if (enableRulesForHtml) {
            let newMarkdown = Paster.parse(markdown);
            Paster.writeToEditor(newMarkdown);
          } else {
            Paster.writeToEditor(markdown);
          }
        } else {
          const text = await cb.getTextPlain();
          if (Paster.parseByAI(text)) {
            return;
          }
          if (text) {
            let newContent = Paster.parse(text);
            Paster.writeToEditor(newContent);
          }
        }
        break;
      case xclip.ClipboardType.Text:
        const text = await cb.getTextPlain();
        if (await Paster.parseByAI(text)) {
          return;
        }
        if (text) {
          let newContent = Paster.parse(text);
          Paster.writeToEditor(newContent);
        }
        break;
      case xclip.ClipboardType.Image:
        Paster.pasteImage();
        break;
      case xclip.ClipboardType.Unknown:
        Logger.log("Unknown type");
        break;
    }
  }

  /**
   * Download url content in clipboard
   */
  public static async pasteDownload() {
    const shell = xclip.getShell();
    const cb = shell.getClipboard();
    const ctx_type = await cb.getContentType();
    Logger.log("Clipboard Type:", ctx_type);
    switch (ctx_type) {
      case xclip.ClipboardType.Html:
      case xclip.ClipboardType.Text:
        const text = await cb.getTextPlain();
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

  private static writeToEditor(content): Thenable<boolean> {
    let startLine = vscode.window.activeTextEditor.selection.start.line;
    const selection = vscode.window.activeTextEditor.selection;
    let position = new vscode.Position(startLine, selection.start.character);
    return vscode.window.activeTextEditor.edit((editBuilder) => {
      editBuilder.delete(selection);
      editBuilder.insert(position, content);
    });
  }

  /**
   * Replace all predefined variable.
   * @param str path
   * @returns
   */
  private static replacePredefinedVars(str: string) {
    let predefine = new Predefine();
    return Paster.replaceRegPredefinedVars(str, predefine);
  }

  /**
   * Replace all predefined variable with Regexp.
   * @param str path
   * @returns
   */
  private static replaceRegPredefinedVars(str: string, predefine: Predefine) {
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

  static getConfig() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return vscode.workspace.getConfiguration("MarkdownPaste");

    let fileUri = editor.document.uri;
    if (!fileUri) return vscode.workspace.getConfiguration("MarkdownPaste");

    return vscode.workspace.getConfiguration("MarkdownPaste", fileUri);
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
  protected static parsePasteImageContext(
    inputVal: string
  ): PasteImageContext | null {
    if (!inputVal) return;

    inputVal = Paster.replacePredefinedVars(inputVal);

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
    if (inputVal.substring(1, 2) === ":") {
      inputVal = "file:///" + inputVal;
    }

    let pasteImgContext = new PasteImageContext();

    let inputUri = vscode.Uri.parse(inputVal);

    const last_char = inputUri.fsPath.slice(inputUri.fsPath.length - 1);
    if (["/", "\\"].includes(last_char)) {
      // While filename is empty(ex: /abc/?200,20),  paste clipboard to a temporay file, then convert it to base64 image to markdown.
      pasteImgContext.targetFile = newTemporaryFilename();
      pasteImgContext.convertToBase64 = true;
      pasteImgContext.removeTargetFileAfterConvert = true;
    } else {
      pasteImgContext.targetFile = inputUri;
      pasteImgContext.convertToBase64 = false;
      pasteImgContext.removeTargetFileAfterConvert = false;
    }

    let enableImgTagConfig = Paster.getConfig().enableImgTag;
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
    let pasteImgContext = Paster.parsePasteImageContext(targetPath);
    if (!pasteImgContext || !pasteImgContext.targetFile) return;

    let imgPath = pasteImgContext.targetFile.fsPath;

    if (!prepareDirForFile(imgPath)) {
      vscode.window.showErrorMessage("Make folder failed:" + imgPath);
      return;
    }

    // save image and insert to current edit file
    const shell = xclip.getShell();
    const cb = shell.getClipboard();
    const imagePath = await cb.getImage(imgPath);
    if (!imagePath) return;
    if (imagePath === "no image") {
      vscode.window.showInformationMessage(
        "There is not an image in the clipboard."
      );
      return;
    }

    Paster.renderMarkdownLink(pasteImgContext);
  }

  private static getDimensionProps(width: any, height: any) {
    const widthProp = width === undefined ? "" : `width='${width}'`;
    const heightProp = height === undefined ? "" : `height='${height}'`;

    return [widthProp, heightProp].join(" ").trim();
  }

  private static renderMdFilePath(pasteImgContext: PasteImageContext): string {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let fileUri = editor.document.uri;
    if (!fileUri) return;
    let basePath = path.dirname(fileUri.fsPath);

    // relative will be add backslash characters so need to replace '\' to '/' here.
    let imageFilePath = Paster.encodePath(
      path.relative(basePath, pasteImgContext.targetFile.fsPath)
    );

    // parse imageFilePath by rule again for appling lang_rule to image path
    let parse_result = Paster.parse_rules(imageFilePath);
    if (typeof parse_result === "string") {
      return parse_result;
    }

    //"../../static/images/vscode-paste/cover.png".replace(new RegExp("(.*/static/)(.*)", ""), "/$2")
    let imgTag = pasteImgContext.imgTag;
    if (imgTag) {
      return `<img src='${imageFilePath}' ${Paster.getDimensionProps(
        imgTag.width,
        imgTag.height
      )}/>`;
    }
    return `![${Paster.getAltText()}](${imageFilePath})`;
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
      renderText = `<img src='data:image/png;base64,${renderText}' ${Paster.getDimensionProps(
        imgTag.width,
        imgTag.height
      )}/>`;
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
      renderText = Paster.renderMdImageBase64(pasteImgContext);
    } else {
      renderText = Paster.renderMdFilePath(pasteImgContext);
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

    const encodePathConfig = Paster.getConfig().encodePath;

    if (encodePathConfig == "encodeURI") {
      filePath = encodeURI(filePath);
    } else if (encodePathConfig == "encodeSpaceOnly") {
      filePath = filePath.replace(/ /g, "%20");
    }
    return filePath;
  }

  private static get_rules(languageId) {
    let lang_rules = Paster.getConfig().lang_rules;

    if (languageId === "markdown") {
      return Paster.getConfig().rules;
    }

    // find lang rules
    for (const lang_rule of lang_rules) {
      if (lang_rule.hasOwnProperty(languageId)) {
        return lang_rule[languageId];
      }
    }

    // if not found then return empty
    return [];
  }

  /**
   * Parse content by rules
   * @param content content will be parse
   * @returns
   *  string: if content match rule, will return replaced string
   *  null: dismatch any rule
   */
  private static parse_rules(content): string | null {
    let editor = vscode.window.activeTextEditor;
    let languageId = editor.document.languageId;
    let rules = Paster.get_rules(languageId);
    let applyAllRules = Paster.getConfig().applyAllRules;
    let isApplicable = false;
    for (const rule of rules) {
      const re = new RegExp(rule.regex, rule.options);
      const reps = Paster.replacePredefinedVars(rule.replace);
      if (re.test(content)) {
        content = content.replace(re, reps);
        if (!applyAllRules) {
          return content;
        }
        isApplicable = true;
      }
    }
    if (isApplicable) {
      return content;
    } else {
      return null;
    }
  }

  private static parse(content) {
    let editor = vscode.window.activeTextEditor;
    let fileUri = editor.document.uri;

    // parse content by rule, if match return replaced string,
    // else return origin content
    let ret = Paster.parse_rules(content);
    if (typeof ret === "string") {
      return ret;
    }

    try {
      // if copied content is an exist file path that under folder of workspace root path
      // then add a relative link into markdown.
      if (existsSync(content)) {
        let current_file_path = fileUri.fsPath;
        let workspace_root_dir =
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders[0].uri.path;

        if (content.startsWith(workspace_root_dir)) {
          let relative_path = Paster.encodePath(
            path.relative(path.dirname(current_file_path), content)
          );

          return `![${Paster.getAltText()}](${relative_path})`;
        }
      }
    } catch (error) {
      // do nothing
      // Logger.log(error);
    }

    return content;
  }

  /**
   * Download image to local and render markdown link for it.
   * @param image_url
   */
  private static pasteImageURL(image_url) {
    let filename = image_url.split("/").pop().split("?")[0];
    let ext = path.extname(filename);
    let imagePath = Paster.genTargetImagePath(ext);
    if (!imagePath) return;

    let silence = Paster.getConfig().silence;
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
    let pasteImgContext = Paster.parsePasteImageContext(target);

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

        if (imagePath.substring(1, 2) === ":") {
          imagePath = "file:///" + imagePath;
        }
        pasteImgContext.targetFile = vscode.Uri.parse(imagePath);

        Paster.renderMarkdownLink(pasteImgContext);
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
    let imagePath = Paster.genTargetImagePath(ext);
    if (!imagePath) return;

    let silence = Paster.getConfig().silence;

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

    // get image destination path
    let folderPathFromConfig = Paster.getConfig().path;

    folderPathFromConfig = Paster.replacePredefinedVars(folderPathFromConfig);

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
    let namePrefix = Paster.getConfig().namePrefix;
    let nameBase = Paster.getConfig().nameBase;
    let nameSuffix = Paster.getConfig().nameSuffix;
    imageFileName = namePrefix + nameBase + nameSuffix + extension;
    imageFileName = Paster.replacePredefinedVars(imageFileName);

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

  private static getAltText(): string {
    const selection = vscode.window.activeTextEditor.selection;
    const selectText =
      vscode.window.activeTextEditor.document.getText(selection);
    return selectText;
  }
}

export { Paster };
