import * as url from "url";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { mkdir } from "shelljs";
import * as fs from "fs";
import moment from "moment";
import { Uri } from "vscode";
import * as os from "os";
import isWsl from "is-wsl";
import Logger from "./Logger";
export type Platform = "darwin" | "win32" | "win10" | "linux" | "wsl";

/**
 * prepare directory for specified file.
 * @param filePath
 */
function prepareDirForFile(filePath: string) {
  let dirName = path.dirname(filePath);
  try {
    mkdir("-p", dirName);
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
  return new Promise((resolve, reject) => {
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
        // If the filename does not have an extension, get the content type from the response headers
        if (filename.indexOf(".") < 0) {
          const contentType = response.headers["content-type"];
          filename += `.${contentType.split("/")[1]}`;
        }
        // Get the target path
        const targetPath = `${dest}/${filename}`;
        // Resolve the promise when the response ends
        response.on("end", function () {
          resolve(targetPath);
        });
        // If the response status code is 200, create a write stream to the target path
        if (response.statusCode === 200) {
          if (prepareDirForFile(targetPath)) {
            const file = fs.createWriteStream(targetPath);
            response.pipe(file);
          } else {
            reject("Make folder failed:" + dest);
          }
          // Reject the promise if the response status code is not 200
        } else {
          reject(`Downloading ${fileURL} failed`);
        }
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
 * Temporary file class
 */
function newTemporaryFilename(prefix = "markdown_paste"): Uri {
  let tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return Uri.parse(path.join(tempDir, moment().format("Y-MM-DD-HH-mm-ss")));
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

const getCurrentPlatform = (): Platform => {
  const platform = process.platform;
  if (isWsl) {
    return "wsl";
  }
  if (platform === "win32") {
    const currentOS = os.release().split(".")[0];
    if (currentOS === "10") {
      return "win10";
    } else {
      return "win32";
    }
  } else if (platform === "darwin") {
    return "darwin";
  } else {
    return "linux";
  }
};

export {
  prepareDirForFile,
  fetchAndSaveFile,
  base64Encode,
  newTemporaryFilename,
  getCurrentPlatform,
};
