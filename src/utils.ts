"use strict";
import * as url from "url";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { mkdir } from "shelljs";
import * as fs from "fs";
import * as moment from "moment";
import { Uri } from "vscode";
import * as os from "os";
import isWsl = require("is-wsl");
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
 * Fetch file to specified local folder
 * @param fileURL
 * @param dest
 */
function fetchAndSaveFile(fileURL, filepath) {
  let dest = path.dirname(filepath);
  let basename = path.basename(filepath);
  return new Promise((resolve, reject) => {
    const timeout = 10000;
    const urlParsed = url.parse(fileURL);
    const uri = urlParsed.pathname.split("/");

    let req;
    let filename = basename || uri[uri.length - 1].match(/(\w*\.?-?)+/)[0];

    if (urlParsed.protocol === null) {
      fileURL = "http://" + fileURL;
    }

    req = urlParsed.protocol === "https:" ? https : http;

    let request = req
      .get(fileURL, (response) => {
        // Make sure extension is present (mostly for images)
        if (filename.indexOf(".") < 0) {
          const contentType = response.headers["content-type"];
          filename += `.${contentType.split("/")[1]}`;
        }

        const targetPath = `${dest}/${filename}`;

        response.on("end", function () {
          resolve(targetPath);
        });

        if (response.statusCode === 200) {
          if (prepareDirForFile(targetPath)) {
            var file = fs.createWriteStream(targetPath);
            response.pipe(file);
          } else {
            reject("Make folder failed:" + dest);
          }
        } else {
          reject(`Downloading ${fileURL} failed`);
        }
      })
      .setTimeout(timeout, () => {
        request.abort();
        reject(`Request Timeout(${timeout} ms):Download ${fileURL} failed!`);
      })
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
  var bitmap = fs.readFileSync(file);
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
