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
  isRemoteMode,
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

  static async parseByAI(content: string) {
    if (Paster.config.enableAI) {
      const p = new AIPaster();
      const result = await p.callAI(content);
      if (result.status == "success") {
        await Paster.writeToEditor(result.message);
        return;
      }
    }
    Paster.writeToEditor(content);
  }

  static async selectClipboardType(
    type: Set<xclip.ClipboardType> | xclip.ClipboardType
  ): Promise<xclip.ClipboardType> {
    if (!(type instanceof Set)) {
      return type;
    }
    if (
      this.config.autoSelectClipboardType == "never" ||
      (this.config.autoSelectClipboardType == "html&text" &&
        type.has(xclip.ClipboardType.Image))
    ) {
      const selected = await vscode.window.showInformationMessage(
        "There are multiple types of content in your clipboard. Which one do you want to use?",
        {
          modal: true,
        },
        ...Array.from(type)
      );
      if (selected) {
        return selected;
      }
      return xclip.ClipboardType.Unknown;
    }
    const priorityOrdering = this.config.autoSelectClipboardTypePriority;
    for (const theType of priorityOrdering)
      if (type.has(theType)) return theType;
    return xclip.ClipboardType.Unknown;
  }

  /**
   * Paste text
   */
  public static async paste() {
    const shell = xclip.getShell();
    const cb = shell.getClipboard();
    const ctx_type = await this.selectClipboardType(await cb.getContentType());

    let enableHtmlConverter = this.config.enableHtmlConverter;
    let enableRulesForHtml = this.config.enableRulesForHtml;
    let turndownOptions = this.config.turndownOptions;

    Logger.log("Clipboard Type:", ctx_type);
    switch (ctx_type) {
      case xclip.ClipboardType.Html:
        if (enableHtmlConverter) {
          const html = await cb.getTextHtml();
          let markdown = toMarkdown(html, turndownOptions);
          if (enableRulesForHtml) {
            markdown = Paster.parse(markdown);
          }
          await Paster.parseByAI(markdown);
        } else {
          const text = await cb.getTextPlain();
          if (text) {
            let newContent = Paster.parse(text);
            await Paster.parseByAI(newContent);
          }
        }
        break;
      case xclip.ClipboardType.Text:
        const text = await cb.getTextPlain();
        if (text) {
          let newContent = Paster.parse(text);
          await Paster.parseByAI(newContent);
        }
        break;
      case xclip.ClipboardType.Image:
        if (false === isRemoteMode()) {
          Paster.pasteImage();
        } else {
          // show warring dialog
          Logger.showErrorMessage(
            "Paste Image is not available in Remote Mode (SSH, WSL, Dev Container). " +
              "Please paste the image locally, or use VS Code’s built-in paste feature instead."
          );
        }
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
    const ctx_type = await this.selectClipboardType(await cb.getContentType());
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

  static getConfig() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return vscode.workspace.getConfiguration("MarkdownPaste");

    let fileUri = editor.document.uri;
    if (!fileUri) return vscode.workspace.getConfiguration("MarkdownPaste");

    return vscode.workspace.getConfiguration("MarkdownPaste", fileUri);
  }

  static get config() {
    return Paster.getConfig();
  }

  /**
   * Returns the first matching image rule (if any) based on the current Markdown file path.
   * Preprocesses variables (including timestamp) once and reuses them in both targetPath and linkPattern.
   */
  private static getMatchingImageRule(): any {
    const config = Paster.getConfig();
    const rules = config.imageRules;
    if (!rules) return null;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    const currentFilePath = editor.document.uri.fsPath;
    for (const rule of rules) {
      if (rule.match) {
        const re = new RegExp(rule.match, rule.options || "");
        const match = re.exec(currentFilePath);
        if (match) {
          let processedRule = { ...rule };
          if (processedRule.targetPath) {
            processedRule.targetPath = Predefine.replacePredefinedVars(
              processedRule.targetPath
            );
            match.forEach((value, index) => {
              if (index === 0) return;
              processedRule.targetPath = processedRule.targetPath.replaceAll(
                `$${index}`,
                value
              );
            });
          }
          if (processedRule.linkPattern) {
            processedRule.linkPattern = Predefine.replacePredefinedVars(
              processedRule.linkPattern
            );
            match.forEach((value, index) => {
              if (index === 0) return;
              processedRule.linkPattern = processedRule.linkPattern.replaceAll(
                `$${index}`,
                value
              );
            });
          }
          return processedRule;
        }
      }
    }
    return null;
  }

  /**
   * Generate a path for the target image.
   * @param extension Extension of target image file.
   * @returns The generated image path.
   */
  private static genTargetImagePath(extension: string = ".png"): string {
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

    // Check if a custom image rule applies.
    const rule = Paster.getMatchingImageRule();
    if (rule && rule.targetPath) {
      let targetPattern = rule.targetPath;
      // targetPattern is already processed in getMatchingImageRule
      // If the rule's pattern does not include an extension, append it.
      if (path.extname(targetPattern) === "") {
        targetPattern += extension;
      }
      return targetPattern;
    }

    // Fallback: default behavior.
    const filePath = fileUri.fsPath;
    let folderPathFromConfig = Paster.getConfig().path;
    folderPathFromConfig =
      Predefine.replacePredefinedVars(folderPathFromConfig);

    let imageFileName = "";
    const namePrefix = Paster.getConfig().namePrefix;
    const nameBase = Paster.getConfig().nameBase;
    const nameSuffix = Paster.getConfig().nameSuffix;
    imageFileName = namePrefix + nameBase + nameSuffix + extension;
    imageFileName = Predefine.replacePredefinedVars(imageFileName);

    const folderPath = path.dirname(filePath);
    let imagePath = "";
    if (path.isAbsolute(folderPathFromConfig)) {
      imagePath = path
        .join(folderPathFromConfig, imageFileName)
        .replace(/\\/g, "/");
    } else {
      imagePath = path
        .join(folderPath, folderPathFromConfig, imageFileName)
        .replace(/\\/g, "/");
    }
    return imagePath;
  }

  /**
   * Generate Markdown link for a saved image.
   */
  private static renderMdFilePath(pasteImgContext: PasteImageContext): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const fileUri = editor.document.uri;
    if (!fileUri) return;
    const basePath = path.dirname(fileUri.fsPath);

    // Compute the image file path relative to the current file.
    let imageFilePath = Paster.encodePath(
      path.relative(basePath, pasteImgContext.targetFile.fsPath)
    );

    // Apply any language rules (if configured).
    const parse_result = Paster.parse_rules(imageFilePath);
    if (typeof parse_result === "string") {
      return parse_result;
    }

    // If a custom link pattern is defined via a matching rule, use it.
    const rule = Paster.getMatchingImageRule();
    if (rule && rule.linkPattern) {
      const altText = Paster.getAltText();
      let link = rule.linkPattern;
      // linkPattern is already processed in getMatchingImageRule
      // Replace custom placeholders.
      link = link
        .replace(/\$\{imageFilePath\}/g, imageFilePath)
        .replace(/\$\{altText\}/g, altText);
      return link;
    }

    // Default: use image tag if width/height are specified.
    const imgTag = pasteImgContext.imgTag;
    if (imgTag) {
      return `<img src='${imageFilePath}' ${Paster.getDimensionProps(
        imgTag.width,
        imgTag.height
      )}/>`;
    }
    return `![${Paster.getAltText()}](${imageFilePath})`;
  }

  private static getDimensionProps(width: any, height: any) {
    const widthProp = width === undefined ? "" : `width='${width}'`;
    const heightProp = height === undefined ? "" : `height='${height}'`;
    return [widthProp, heightProp].join(" ").trim();
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
    const imgTag = pasteImgContext.imgTag;
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
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    let renderText: string;
    if (pasteImgContext.convertToBase64) {
      renderText = Paster.renderMdImageBase64(pasteImgContext);
    } else {
      renderText = Paster.renderMdFilePath(pasteImgContext);
    }

    if (renderText) {
      editor.edit((edit) => {
        const current = editor.selection;
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
   * encodeSpaceOnly  : encode all space characters to %20
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
    for (const lang_rule of lang_rules) {
      if (lang_rule.hasOwnProperty(languageId)) {
        return lang_rule[languageId];
      }
    }
    return [];
  }

  /**
   * Parse content by rules.
   * @param content Content to parse.
   * @returns Replaced string if a rule matched; otherwise, the original content.
   */
  private static parse_rules(content): string | null {
    const editor = vscode.window.activeTextEditor;
    const languageId = editor.document.languageId;
    const rules = Paster.get_rules(languageId);
    const applyAllRules = Paster.getConfig().applyAllRules;
    let isApplicable = false;
    for (const rule of rules) {
      const re = new RegExp(rule.regex, rule.options);
      const reps = Predefine.replacePredefinedVars(rule.replace);
      if (re.test(content)) {
        content = content.replace(re, reps);
        if (!applyAllRules) {
          return content;
        }
        isApplicable = true;
      }
    }
    return isApplicable ? content : null;
  }

  static parse(content) {
    const editor = vscode.window.activeTextEditor;
    const fileUri = editor.document.uri;
    const ret = Paster.parse_rules(content);
    if (typeof ret === "string") {
      return ret;
    }
    try {
      if (existsSync(content)) {
        const current_file_path = fileUri.fsPath;
        const workspace_root_dir =
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders[0].uri.path;
        if (content.startsWith(workspace_root_dir)) {
          const relative_path = Paster.encodePath(
            path.relative(path.dirname(current_file_path), content)
          );
          return `![${Paster.getAltText()}](${relative_path})`;
        }
      }
    } catch (error) {
      // Do nothing.
    }
    return content;
  }

  /**
   * Download image from URL and render Markdown link.
   * @param image_url
   */
  private static pasteImageURL(image_url) {
    const filename = image_url.split("/").pop().split("?")[0];
    const ext = path.extname(filename);
    let imagePath = Paster.genTargetImagePath(ext);
    if (!imagePath) return;
    const silence = Paster.getConfig().silence;
    if (silence) {
      Paster.downloadFile(image_url, imagePath);
    } else {
      const options: vscode.InputBoxOptions = {
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
    const pasteImgContext = Paster.parsePasteImageContext(target);
    if (!pasteImgContext || !pasteImgContext.targetFile) return;
    const imgPath = pasteImgContext.targetFile.fsPath;
    if (!prepareDirForFile(imgPath)) {
      vscode.window.showErrorMessage("Make folder failed:" + imgPath);
      return;
    }
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
   * Paste clipboard image to file and render Markdown link.
   */
  private static pasteImage() {
    const ext = ".png";
    let imagePath = Paster.genTargetImagePath(ext);
    if (!imagePath) return;
    const silence = Paster.getConfig().silence;
    if (silence) {
      Paster.saveImage(imagePath);
    } else {
      const options: vscode.InputBoxOptions = {
        prompt:
          "You can change the filename. The existing file will be overwritten!",
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
   * Save the image from the clipboard and insert the Markdown link.
   * @param targetPath
   */
  protected static async saveImage(targetPath: string) {
    const pasteImgContext = Paster.parsePasteImageContext(targetPath);
    if (!pasteImgContext || !pasteImgContext.targetFile) return;
    const imgPath = pasteImgContext.targetFile.fsPath;
    if (!prepareDirForFile(imgPath)) {
      vscode.window.showErrorMessage("Make folder failed:" + imgPath);
      return;
    }
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

  /**
   * Generate a PasteImageContext from the input value.
   * The input can include query parameters for width and height.
   * @param inputVal
   * @returns PasteImageContext or null if invalid.
   */
  protected static parsePasteImageContext(
    inputVal: string
  ): PasteImageContext | null {
    if (!inputVal) return;
    inputVal = Predefine.replacePredefinedVars(inputVal);
    if (inputVal && inputVal.length !== inputVal.trim().length) {
      vscode.window.showErrorMessage(
        'The specified path is invalid: "' + inputVal + '"'
      );
      return;
    }
    if (inputVal.substring(1, 2) === ":") {
      inputVal = "file:///" + inputVal;
    }
    const pasteImgContext = new PasteImageContext();
    const inputUri = vscode.Uri.parse(inputVal);
    const last_char = inputUri.fsPath.slice(-1);
    if (["/", "\\"].includes(last_char)) {
      pasteImgContext.targetFile = newTemporaryFilename();
      pasteImgContext.convertToBase64 = true;
      pasteImgContext.removeTargetFileAfterConvert = true;
    } else {
      pasteImgContext.targetFile = inputUri;
      pasteImgContext.convertToBase64 = false;
      pasteImgContext.removeTargetFileAfterConvert = false;
    }
    const enableImgTagConfig = Paster.getConfig().enableImgTag;
    if (enableImgTagConfig && inputUri.query) {
      const ar = inputUri.query.split(",");
      if (ar) {
        pasteImgContext.imgTag = {
          width: ar[0],
          height: ar[1],
        };
      }
    }
    return pasteImgContext;
  }

  private static getAltText(): string {
    const selection = vscode.window.activeTextEditor.selection;
    const selectText =
      vscode.window.activeTextEditor.document.getText(selection);
    return selectText;
  }
}

export { Paster };
