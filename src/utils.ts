import * as url from "url";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as fs from "fs";
import moment from "moment";
import * as vscode from "vscode";
import * as os from "os";
import Logger from "./Logger";
import { parentUri } from "./path_space";

/**
 * prepare directory for specified file.
 * @param filePath
 */
function prepareDirForFile(filePath: string) {
  const dirName = path.dirname(filePath);
  try {
    // `recursive` has the same mkdir -p semantics and does not fail when the
    // directory already exists.
    fs.mkdirSync(dirName, { recursive: true });
  } catch (error) {
    Logger.log(error);
    return false;
  }
  return true;
}

/**
 * @description fetches the file from given URL and saves it in the filepath
 * @param {string} fileURL the URL of the file to be fetched
 * @param {string} filepath the directory path to store the file
 * @return {Promise} Promise object that resolves with the path at which the file is saved when fetch is successful
 */
function fetchAndSaveFile(fileURL: string, filepath: string) {
  // Get the directory and basename of the filepath
  const dest = path.dirname(filepath);
  const basename = path.basename(filepath);
  return new Promise<string>((resolve, reject) => {
    // Set a timeout of 10 seconds for the request
    const timeout = 10000;
    // Parse the URL
    const urlParsed = new url.URL(fileURL);
    // Get the filename from the URL
    const uri = urlParsed.pathname.split("/");
    let req;
    let filename = basename || uri[uri.length - 1].match(/(\w*\.?-?)+/)[0];
    // If the URL does not have a protocol, add http://
    if (urlParsed.protocol === null) {
      fileURL = "http://" + fileURL;
    }
    // Set the request to either http or https
    req = urlParsed.protocol === "https:" ? https : http;
    let request = req
      .get(fileURL, (response) => {
        // Handle redirects (301, 302, 307, 308)
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          // Get the redirect URL
          const redirectUrl = new URL(response.headers.location, fileURL).href;
          // Follow the redirect by calling fetchAndSaveFile again with the new URL
          fetchAndSaveFile(redirectUrl, filepath)
            .then((redirectPath) => resolve(redirectPath))
            .catch((err) => reject(err));
          return;
        }

        // If the filename does not have an extension, get the content type from the response headers
        if (filename.indexOf(".") < 0) {
          const contentType = response.headers["content-type"] || "image/png";
          filename += `.${contentType.split("/")[1] || "png"}`;
        }
        // Get the target path
        const targetPath = `${dest}/${filename}`;
        // Reject the promise if the response status code is not 200
        if (response.statusCode !== 200) {
          response.resume();
          reject(`Downloading ${fileURL} failed`);
          return;
        }
        if (!prepareDirForFile(targetPath)) {
          response.resume();
          reject("Make folder failed:" + dest);
          return;
        }
        const file = fs.createWriteStream(targetPath);
        // Resolve only once the bytes are on disk: resolving on the response
        // "end" event raced with the write stream flush.
        file.on("close", () => resolve(targetPath));
        file.on("error", (err) =>
          reject(`Saving ${targetPath} failed: ${err}`)
        );
        response.on("error", (err) =>
          reject(`Downloading ${fileURL} failed: ${err}`)
        );
        response.pipe(file);
      })
      // Abort the request if it times out
      .setTimeout(timeout, () => {
        request.abort();
        reject(`Request Timeout(${timeout} ms):Download ${fileURL} failed!`);
      })
      // Reject the promise if there is an error
      .on("error", (e) => {
        reject(`Downloading ${fileURL} failed! Please make sure URL is valid.`);
      });
  });
}

/**
 * A file created in the OS temp directory, used as a staging area between the
 * local clipboard helper and the (possibly remote) target file system.
 */
interface LocalTempFile {
  /** The temp directory that owns the file (removed when done). */
  dir: string;
  /** Absolute local path of the file itself. */
  path: string;
}

/**
 * Create a fresh local temp directory with a file name inside it.
 * @param extension appended to the file name, e.g. ".png"
 */
function newLocalTempFile(extension = ""): LocalTempFile {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "markdown_paste"));
  const fileName = `${moment().format("Y-MM-DD-HH-mm-ss")}${extension}`;
  return { dir, path: path.join(dir, fileName) };
}

/**
 * Remove a temp directory created by {@link newLocalTempFile}.
 */
function removeLocalTempDir(dir: string) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    Logger.log(error);
  }
}

/**
 * Send a local file to a (possibly remote) target URI.
 *
 * The clipboard helpers can only write to the local disk, so the bytes are
 * staged locally and then handed to VS Code's file system service, which routes
 * them to the provider owning `target` (local disk, WSL, SSH, container, ...).
 */
async function transferLocalFileToUri(
  localPath: string,
  target: vscode.Uri
): Promise<void> {
  const bytes = await fs.promises.readFile(localPath);
  // `createDirectory` has mkdirp semantics; an already existing directory is not
  // an error worth surfacing here because `writeFile` reports real failures.
  try {
    await vscode.workspace.fs.createDirectory(parentUri(target));
  } catch (error) {
    // Ignore: writeFile below reports genuine problems.
  }
  await vscode.workspace.fs.writeFile(target, bytes);
}

/**
 * Encode local file data to base64 encoded string
 * @param file
 * @returns base64 code string
 */
function base64Encode(file) {
  const bitmap = fs.readFileSync(file);
  return Buffer.from(bitmap).toString("base64");
}

export {
  prepareDirForFile,
  fetchAndSaveFile,
  base64Encode,
  newLocalTempFile,
  removeLocalTempDir,
  transferLocalFileToUri,
};

export type { LocalTempFile };
