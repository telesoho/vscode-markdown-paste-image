import * as path from "path";
import * as vscode from "vscode";
import * as xclip from "xclip";
import { toMarkdown } from "./toMarkdown";
import { Predefine } from "./predefine";
import { AIPaster } from "./ai_paster";
import {
  newLocalTempFile,
  removeLocalTempDir,
  transferLocalFileToUri,
  fetchAndSaveFile,
} from "./utils";
import { rmSync } from "fs";
import { LanguageDetection } from "./language_detection";
import Logger from "./Logger";
import {
  PathSpace,
  TargetPath,
  basenameOf,
  dirnameOf,
  fromDisplayPath,
  getPathSpace,
  hasExplicitScheme,
  implFor,
  isRemoteUri,
  normalizeDisplay,
  parentUri,
  resolveDisplayPath,
  toDisplayPath,
  wslUncCandidates,
} from "./path_space";

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
            markdown = await Paster.parse(markdown);
          }
          await Paster.parseByAI(markdown);
        } else {
          const text = await cb.getTextPlain();
          if (text) {
            let newContent = await Paster.parse(text);
            await Paster.parseByAI(newContent);
          }
        }
        break;
      case xclip.ClipboardType.Text:
        const text = await cb.getTextPlain();
        if (text) {
          let newContent = await Paster.parse(text);
          await Paster.parseByAI(newContent);
        }
        break;
      case xclip.ClipboardType.Image:
        Paster.warnIfExtensionRunsRemotely();
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
    const docUri = editor.document.uri;
    // Try both the native and the display form, so rules written before remote
    // support (which may contain backslashes) keep matching.
    const candidates = [docUri.fsPath, toDisplayPath(docUri)];
    for (const rule of rules) {
      if (!rule.match) continue;
      for (const candidate of candidates) {
        if (!candidate) continue;
        const re = new RegExp(rule.match, rule.options || "");
        const match = re.exec(candidate);
        if (!match) continue;
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
    return null;
  }

  /**
   * Resolve a target path expression into a display path. Absolute expressions
   * (POSIX, Windows drive or explicit URI) are kept, relative ones are resolved
   * against the directory of the document being edited.
   */
  private static resolveTargetDisplay(
    docUri: vscode.Uri,
    space: PathSpace,
    target: string
  ): string {
    if (hasExplicitScheme(target)) return target;
    const impl = implFor(space);
    return resolveDisplayPath(
      dirnameOf(docUri, space),
      space,
      impl.join(target)
    );
  }

  /**
   * Generate the target for the pasted image.
   * @param extension Extension of target image file.
   */
  private static genTargetImage(
    extension: string = ".png"
  ): TargetPath | undefined {
    let editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;
    let fileUri = editor.document.uri;
    if (!fileUri) return undefined;
    if (fileUri.scheme === "untitled") {
      vscode.window.showInformationMessage(
        "Before pasting an image, you need to save the current edited file first."
      );
      return undefined;
    }

    // Paths are computed in the dialect of the document's file system, so a
    // remote document keeps its POSIX paths instead of being translated into
    // local Windows paths.
    const space = getPathSpace(fileUri);
    const impl = implFor(space);

    // Check if a custom image rule applies.
    const rule = Paster.getMatchingImageRule();
    if (rule && rule.targetPath) {
      let targetPattern = rule.targetPath;
      // targetPattern is already processed in getMatchingImageRule
      // If the rule's pattern does not include an extension, append it.
      if (impl.extname(targetPattern) === "") {
        targetPattern += extension;
      }
      const display = Paster.resolveTargetDisplay(
        fileUri,
        space,
        targetPattern
      );
      return { display, uri: fromDisplayPath(fileUri, display) };
    }

    // Fallback: default behavior.
    const config = Paster.getConfig();
    let folderPathFromConfig = Predefine.replacePredefinedVars(
      config.path || ""
    );
    if (!folderPathFromConfig) folderPathFromConfig = ".";

    if (space !== "win32" && /^[a-zA-Z]:[\\/]/.test(folderPathFromConfig)) {
      vscode.window.showErrorMessage(
        `MarkdownPaste.path "${folderPathFromConfig}" is a Windows path, but the current document is on a remote file system. ` +
          `Use a path in the document's file system instead (e.g. "\${fileDirname}/images").`
      );
      return undefined;
    }

    let imageFileName = "";
    const namePrefix = config.namePrefix ?? "";
    const nameBase = config.nameBase ?? "";
    const nameSuffix = config.nameSuffix ?? "";
    imageFileName = namePrefix + nameBase + nameSuffix + extension;
    imageFileName = Predefine.replacePredefinedVars(imageFileName);

    const display = Paster.resolveTargetDisplay(
      fileUri,
      space,
      impl.join(folderPathFromConfig, imageFileName)
    );
    return { display, uri: fromDisplayPath(fileUri, display) };
  }

  /**
   * Generate Markdown link for a saved image.
   */
  private static renderMdFilePath(pasteImgContext: PasteImageContext): string {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const fileUri = editor.document.uri;
    if (!fileUri) return;

    // Relative links are computed in the dialect of the document's file
    // system, so remote documents get POSIX relative links.
    const space = getPathSpace(fileUri);
    const impl = implFor(space);
    const docDir = dirnameOf(fileUri, space);
    const targetDisplay = toDisplayPath(pasteImgContext.targetFile, space);

    let basePath: string;

    const config = Paster.getConfig();
    const customBasePath =
      config.basePath !== undefined
        ? config.basePath
        : typeof config.get === "function"
        ? config.get("basePath")
        : undefined;

    if (customBasePath && customBasePath.trim() !== "") {
      basePath = resolveDisplayPath(
        docDir,
        space,
        Predefine.replacePredefinedVars(customBasePath)
      );
    } else {
      // Original behavior
      basePath = docDir;
    }

    let imageFilePath = impl.relative(basePath, targetDisplay);
    imageFilePath = imageFilePath.replace(/\\/g, "/");

    if (
      customBasePath &&
      !impl.isAbsolute(imageFilePath) &&
      !imageFilePath.startsWith("/")
    ) {
      imageFilePath = "/" + imageFilePath;
    }

    imageFilePath = Paster.encodePath(imageFilePath);

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

  private static async renderMdImageBase64(
    pasteImgContext: PasteImageContext
  ): Promise<string | undefined> {
    const targetUri = pasteImgContext.targetFile;
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(targetUri);
    } catch (error) {
      Logger.showErrorMessage("Failed to read the pasted image: " + error);
      return undefined;
    }

    let renderText = Buffer.from(bytes).toString("base64");
    const imgTag = pasteImgContext.imgTag;
    if (imgTag) {
      renderText = `<img src='data:image/png;base64,${renderText}' ${Paster.getDimensionProps(
        imgTag.width,
        imgTag.height
      )}/>`;
    } else {
      renderText = `![](data:image/png;base64,${renderText})`;
    }

    if (
      pasteImgContext.removeTargetFileAfterConvert &&
      targetUri.scheme === "file"
    ) {
      // In base64 mode the image only lives in a local temporary directory.
      rmSync(path.dirname(targetUri.fsPath), {
        recursive: true,
        force: true,
      });
    }

    return renderText;
  }

  public static async renderMarkdownLink(
    pasteImgContext: PasteImageContext
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    let renderText: string | undefined;
    if (pasteImgContext.convertToBase64) {
      renderText = await Paster.renderMdImageBase64(pasteImgContext);
    } else {
      renderText = Paster.renderMdFilePath(pasteImgContext);
    }

    if (renderText) {
      await editor.edit((edit) => {
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

  /**
   * Turn a pasted path that exists on the document's file system into a
   * relative image link. Works for local and remote documents alike: the path
   * is resolved in the dialect of the document, and existence is checked
   * through the document's file system provider.
   */
  static async parse(content: string) {
    const editor = vscode.window.activeTextEditor;
    const fileUri = editor.document.uri;
    const ret = Paster.parse_rules(content);
    if (typeof ret === "string") {
      return ret;
    }
    try {
      const space = getPathSpace(fileUri);
      const impl = implFor(space);
      const docDir = dirnameOf(fileUri, space);
      const contentDisplay = hasExplicitScheme(content)
        ? content
        : resolveDisplayPath(
            docDir,
            space,
            impl.join(normalizeDisplay(content, space))
          );
      const contentUri = fromDisplayPath(fileUri, contentDisplay);
      if (!(await Paster.uriExists(contentUri))) {
        return content;
      }
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspaceRootDisplay = workspaceFolder
        ? toDisplayPath(workspaceFolder.uri, getPathSpace(workspaceFolder.uri))
        : "";
      if (
        workspaceRootDisplay &&
        contentDisplay.startsWith(workspaceRootDisplay)
      ) {
        const relative_path = Paster.encodePath(
          impl.relative(docDir, contentDisplay).replace(/\\/g, "/")
        );
        return `![${Paster.getAltText()}](${relative_path})`;
      }
    } catch (error) {
      // Do nothing.
    }
    return content;
  }

  private static async uriExists(target: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(target);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Download image from URL and render Markdown link.
   * @param image_url
   */
  private static pasteImageURL(image_url: string) {
    const filename = image_url.split("/").pop().split("?")[0];
    const ext = path.posix.extname(filename);
    const target = Paster.genTargetImage(ext);
    if (!target) return;
    const silence = Paster.getConfig().silence;
    if (silence) {
      Paster.downloadFile(image_url, target.display);
    } else {
      const options: vscode.InputBoxOptions = {
        prompt:
          "You can change the filename. The existing file will be overwritten!",
        value: target.display,
        placeHolder: "(e.g:../test/myimg.png?100,60)",
        valueSelection: [
          target.display.length - basenameOf(target.display).length,
          target.display.length - ext.length,
        ],
      };
      vscode.window.showInputBox(options).then((inputVal) => {
        if (inputVal === undefined) return;
        Paster.downloadFile(image_url, inputVal);
      });
    }
  }

  private static async downloadFile(image_url: string, target: string) {
    const pasteImgContext = Paster.parsePasteImageContext(target);
    if (!pasteImgContext || !pasteImgContext.targetFile) return;
    const targetUri = pasteImgContext.targetFile;
    const space = getPathSpace(targetUri);
    const intendedDisplay = toDisplayPath(targetUri, space);

    // Download into a local temporary file first, then transfer it to the
    // document's file system (local or remote). The download has to stay on
    // the UI side, where the network and the clipboard live.
    const tempFile = newLocalTempFile("");
    try {
      const localImagePath = await fetchAndSaveFile(image_url, tempFile.path);
      if (localImagePath === "no image") {
        vscode.window.showInformationMessage(
          "There is not an image in the clipboard."
        );
        return;
      }
      if (!localImagePath) return;
      if (!implFor(space).extname(intendedDisplay)) {
        // The URL carried no extension: adopt the one from the response.
        const downloadedExt = path.posix.extname(localImagePath);
        pasteImgContext.targetFile = fromDisplayPath(
          targetUri,
          intendedDisplay + downloadedExt
        );
      }
      await transferLocalFileToUri(localImagePath, pasteImgContext.targetFile);
      await Paster.renderMarkdownLink(pasteImgContext);
    } catch (err) {
      Logger.showErrorMessage("Download failed:" + err);
    } finally {
      removeLocalTempDir(tempFile.dir);
    }
  }

  private static warnIfExtensionRunsRemotely(): void {
    if (!vscode.env.remoteName) return;
    const extension = vscode.extensions.getExtension(
      "telesoho.vscode-markdown-paste-image"
    );
    if (!extension) return;
    const packageKind = (extension.packageJSON as any).extensionKind;
    const kinds: string[] = Array.isArray(packageKind)
      ? packageKind
      : packageKind
      ? [packageKind]
      : [];
    if (kinds.includes("ui")) return;
    Logger.showErrorMessage(
      "Paste Image needs to run on the UI side to read the local clipboard, " +
        "but it is running in the remote workspace. Add " +
        `"remote.extensionKind": { "telesoho.vscode-markdown-paste-image": ["ui"] } ` +
        "to your user settings to paste images from the local clipboard."
    );
  }

  /**
   * Paste clipboard image to file and render Markdown link.
   */
  private static pasteImage() {
    const ext = ".png";
    const target = Paster.genTargetImage(ext);
    if (!target) return;
    const silence = Paster.getConfig().silence;
    if (silence) {
      Paster.saveImage(target.display);
    } else {
      const options: vscode.InputBoxOptions = {
        prompt:
          "You can change the filename. The existing file will be overwritten!",
        value: target.display,
        placeHolder: "(e.g:../test/myimage.png?100,60)",
        valueSelection: [
          target.display.length - basenameOf(target.display).length,
          target.display.length - ext.length,
        ],
      };
      vscode.window.showInputBox(options).then((inputVal) => {
        if (inputVal === undefined) return;
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

    try {
      if (pasteImgContext.convertToBase64) {
        // Base64 images never touch the document's file system.
        const tempFile = newLocalTempFile(".png");
        if (!(await Paster.saveClipboardImageToLocalFile(tempFile.path))) {
          removeLocalTempDir(tempFile.dir);
          return;
        }
        pasteImgContext.targetFile = vscode.Uri.file(tempFile.path);
        await Paster.renderMarkdownLink(pasteImgContext);
        if (!pasteImgContext.removeTargetFileAfterConvert) {
          removeLocalTempDir(tempFile.dir);
        }
        return;
      }

      const targetUri = pasteImgContext.targetFile;
      const saved = await Paster.saveClipboardImageToUri(
        targetUri,
        getPathSpace(targetUri)
      );
      if (!saved) return;
      await Paster.renderMarkdownLink(pasteImgContext);
    } catch (err) {
      Logger.showErrorMessage("Failed to save the pasted image: " + err);
    }
  }

  private static async saveClipboardImageToUri(
    targetUri: vscode.Uri,
    space: PathSpace
  ): Promise<boolean> {
    // Fast path: WSL exposes its file system as a UNC share, which lets the
    // native clipboard helper write the image without an extra round trip.
    if (await Paster.trySaveClipboardImageDirect(targetUri)) return true;

    // Generic path: write locally, then hand the bytes to the file system
    // provider of the target (local, SSH, container, ...). This is the only
    // path that works for every remote, and it works for local files too.
    const tempFile = newLocalTempFile(".png");
    try {
      if (!(await Paster.saveClipboardImageToLocalFile(tempFile.path))) {
        return false;
      }
      await transferLocalFileToUri(tempFile.path, targetUri);
      return true;
    } finally {
      removeLocalTempDir(tempFile.dir);
    }
  }

  /**
   * Ask the clipboard helper to write the PNG straight into the target file
   * system. Only possible when that file system is reachable through a
   * Windows path (WSL's UNC shares). Returns false on any problem: the caller
   * then falls back to the generic transfer path.
   */
  private static async trySaveClipboardImageDirect(
    targetUri: vscode.Uri
  ): Promise<boolean> {
    if (process.platform !== "win32" || !isRemoteUri(targetUri)) return false;
    const display = toDisplayPath(targetUri);
    const candidates = wslUncCandidates(targetUri.authority, display);
    if (candidates.length === 0) return false;

    const cb = xclip.getShell().getClipboard();
    for (const candidate of candidates) {
      try {
        await vscode.workspace.fs.createDirectory(parentUri(targetUri));
        const result = await cb.getImage(candidate);
        if (!result || result === "no image") continue;
        // Make sure the bytes really landed before trusting the shortcut.
        await vscode.workspace.fs.stat(targetUri);
        return true;
      } catch (error) {
        // Try the next candidate, then the generic path.
      }
    }
    return false;
  }

  /**
   * Let the clipboard helper write the clipboard image into a local file.
   * Returns false (after telling the user) when the clipboard has no image.
   */
  private static async saveClipboardImageToLocalFile(
    localPath: string
  ): Promise<boolean> {
    const cb = xclip.getShell().getClipboard();
    const imagePath = await cb.getImage(localPath);
    if (!imagePath) return false;
    if (imagePath === "no image") {
      vscode.window.showInformationMessage(
        "There is not an image in the clipboard."
      );
      return false;
    }
    return true;
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
    if (!inputVal) return null;
    inputVal = Predefine.replacePredefinedVars(inputVal);
    if (inputVal.length !== inputVal.trim().length) {
      vscode.window.showErrorMessage(
        'The specified path is invalid: "' + inputVal + '"'
      );
      return null;
    }

    // Split the optional "?width,height" suffix. "?" is otherwise a legal
    // filename character, so only treat it as a size when it looks like one.
    let targetExpression = inputVal;
    let query = "";
    const queryIndex = targetExpression.indexOf("?");
    if (queryIndex >= 0) {
      const candidateQuery = targetExpression.substring(queryIndex + 1);
      if (/^\d+(,\d+)?$/.test(candidateQuery)) {
        query = candidateQuery;
        targetExpression = targetExpression.substring(0, queryIndex);
      }
    }
    if (!targetExpression) return null;

    const editor = vscode.window.activeTextEditor;
    const docUri = editor ? editor.document.uri : undefined;
    const space: PathSpace = docUri
      ? getPathSpace(docUri)
      : process.platform === "win32"
      ? "win32"
      : "posix";

    const pasteImgContext = new PasteImageContext();
    const trailingSeparator = /[\\/]$/.test(targetExpression);
    if (trailingSeparator) {
      // A trailing separator means "encode the image as a data URI". The
      // actual temporary file is created by saveImage.
      pasteImgContext.targetFile = docUri ?? vscode.Uri.file(process.cwd());
      pasteImgContext.convertToBase64 = true;
      pasteImgContext.removeTargetFileAfterConvert = true;
    } else {
      const impl = implFor(space);
      const baseDir = docUri
        ? dirnameOf(docUri, space)
        : space === "win32"
        ? "C:/"
        : "/";
      const targetDisplay = hasExplicitScheme(targetExpression)
        ? targetExpression
        : resolveDisplayPath(baseDir, space, impl.join(targetExpression));
      pasteImgContext.targetFile = fromDisplayPath(
        docUri ?? vscode.Uri.file(process.cwd()),
        targetDisplay
      );
      pasteImgContext.convertToBase64 = false;
      pasteImgContext.removeTargetFileAfterConvert = false;
    }
    const enableImgTagConfig = Paster.getConfig().enableImgTag;
    if (enableImgTagConfig && query) {
      const ar = query.split(",");
      pasteImgContext.imgTag = {
        width: ar[0],
        height: ar[1],
      };
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
