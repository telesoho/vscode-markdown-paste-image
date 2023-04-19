import { spawn } from "child_process";
import Logger from "./Logger";
import * as path from "path";
import { getCurrentPlatform, Platform } from "./utils";

enum ClipboardType {
  Unknown = -1,
  Html = 0,
  Text,
  Image,
}

function darwin_HextoHtml(str: string) {
  const regex = /«data HTML(.*?)»/;

  // Alternative syntax using RegExp constructor
  // const regex = new RegExp('«data HTML(.*?)»', '')

  const subst = `$1`;

  // The substituted value will be contained in the result variable
  const data = str.replace(regex, subst);

  let buff = Buffer.from(data, "hex");
  return buff.toString("utf8");
}

async function wslSafe(path: string) {
  if (getCurrentPlatform() != "wsl") return path;
  await runCommand("touch", [path]);
  return runCommand("wslpath", ["-m", path]);
}

/**
 * Run shell script.
 * @param script
 * @param parameters
 * @param callback
 */
async function runScript(
  script: Record<Platform, string | null>,
  parameters = []
) {
  let platform = getCurrentPlatform();
  if (script[platform] == null) {
    Logger.log(`No scipt exists for ${platform}`);
    throw new Error(`No scipt exists for ${platform}`);
  }
  const scriptPath = path.join(__dirname, "../res/scripts/" + script[platform]);
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
        "bypass",
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

  let stdout = await runCommand(shell, command);
  return stdout.trim();
  // const runer = runCommand(shell, command);
  // return runer.then((stdout) => stdout.trim());
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

    process.stdout.on("data", (chunk) => {
      Logger.log(chunk);
      output += `${chunk}`;
    });

    process.stderr.on("data", (chunk) => {
      Logger.log(chunk);
      errorMessage += `${chunk}`;
    });

    process.on("exit", (code, signal) => {
      if (process.killed) {
        Logger.log("Process took too long and was killed");
      }

      if (!errorTriggered) {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(errorMessage);
        }
      }
    });

    process.on("error", (error) => {
      errorTriggered = true;
      reject(error);
    });
  });
}

function getClipboardType(types) {
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
          case "no xclip":
            Logger.showErrorMessage("You need to install xclip command first.");
            return ClipboardType.Unknown;
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
    case "darwin":
      for (const type of types) {
        switch (type) {
          case "Text":
            detectedTypes.add(ClipboardType.Text);
            break;
          case "HTML":
            detectedTypes.add(ClipboardType.Html);
            break;
          case "Image":
            detectedTypes.add(ClipboardType.Image);
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
  for (const type of priorityOrdering) if (detectedTypes.has(type)) return type;
  // No known types detected
  return ClipboardType.Unknown;
}

async function getClipboardContentType() {
  const script = {
    linux: "linux_get_clipboard_content_type.sh",
    win32: "win32_get_clipboard_content_type.ps1",
    darwin: "darwin_get_clipboard_content_type.applescript",
    wsl: "win32_get_clipboard_content_type.ps1",
    win10: "win32_get_clipboard_content_type.ps1",
  };

  try {
    let data = await runScript(script, []);
    Logger.log("getClipboardContentType", data);
    let types = data.split(/\r\n|\n|\r/);

    return getClipboardType(types);
  } catch (e) {
    return ClipboardType.Unknown;
  }
}

async function getClipboardTextHtml() {
  const script = {
    win32: "win32_get_clipboard_text_html.ps1",
    linux: "linux_get_clipboard_text_html.sh",
    darwin: "darwin_get_clipboard_text_html.applescript",
    wsl: "win32_get_clipboard_text_html.ps1",
    win10: "win32_get_clipboard_text_html.ps1",
  };
  const data: string = await runScript(script, []);
  const platform: Platform = getCurrentPlatform();
  if (platform === "darwin") {
    return darwin_HextoHtml(data);
  }
  return data;
}

async function getClipboardTextPlain() {
  const script = {
    win32: "win32_get_clipboard_text_plain.ps1",
    linux: "linux_get_clipboard_text_plain.sh",
    darwin: "darwin_get_clipboard_text_plain.applescript",
    wsl: "win32_get_clipboard_text_plain.ps1",
    win10: "win32_get_clipboard_text_plain.ps1",
  };

  return runScript(script, []);
}
/**
 * use applescript to save image from clipboard and get file path
 */
async function saveClipboardImageToFileAndGetPath(imagePath) {
  if (!imagePath) return;

  const script = {
    win32: "win32_save_clipboard_png.ps1",
    darwin: "darwin_save_clipboard_png.applescript",
    linux: "linux_save_clipboard_png.sh",
    wsl: "win32_save_clipboard_png.ps1",
    win10: "win32_save_clipboard_png.ps1",
  };

  return runScript(script, [await wslSafe(imagePath)]);
}

/**
 * use applescript to save image from clipboard and get file path
 */
async function setImageToClipboard(imagePath) {
  if (!imagePath) return;

  const script = {
    win32: "win32_set_clipboard_png.ps1",
    darwin: "darwin_set_clipboard_png.applescript",
    linux: "linux_set_clipboard_png.sh",
    wsl: "win32_save_clipboard_png.ps1",
    win10: "win32_save_clipboard_png.ps1",
  };

  const params = {
    win32: [imagePath],
    darwin: [imagePath],
    linux: [imagePath],
    wsl: [await wslSafe(imagePath)],
    win10: [imagePath],
  };

  return runScript(script, params[getCurrentPlatform()]);
}

/**
 * use applescript to save image from clipboard and get file path
 */
async function setHtmlToClipboard(htmlPath) {
  if (!htmlPath) return;

  const script = {
    win32: "win32_set_clipboard_text_html.ps1",
    darwin: "darwin_set_clipboard_text_html.applescript",
    linux: "linux_set_clipboard_text_html.sh",
    wsl: "win32_set_clipboard_text_html.ps1",
    win10: "win32_set_clipboard_text_html.ps1",
  };

  const params = {
    win32: [htmlPath],
    darwin: [htmlPath],
    linux: [htmlPath],
    wsl: [await wslSafe(htmlPath)],
    win10: [htmlPath],
  };

  return runScript(script, params[getCurrentPlatform()]);
}

/**
 * use applescript to save image from clipboard and get file path
 */
async function setTextToClipboard(textPath) {
  if (!textPath) return;

  const script = {
    win32: "win32_set_clipboard_text_plain.ps1",
    darwin: "darwin_set_clipboard_text_plain.applescript",
    linux: "linux_set_clipboard_text_plain.sh",
    wsl: "win32_set_clipboard_text_plain.ps1",
    win10: "win32_set_clipboard_text_plain.ps1",
  };

  const params = {
    win32: [textPath],
    darwin: [textPath],
    linux: [textPath],
    wsl: [await wslSafe(textPath)],
    win10: [textPath],
  };

  return runScript(script, params[getCurrentPlatform()]);
}

export {
  runCommand,
  wslSafe,
  runScript,
  ClipboardType,
  getClipboardContentType,
  getClipboardType,
  getClipboardTextHtml,
  getClipboardTextPlain,
  saveClipboardImageToFileAndGetPath,
  setImageToClipboard,
  setTextToClipboard,
  setHtmlToClipboard,
};
