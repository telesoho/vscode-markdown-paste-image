"use strict";
import * as url from "url";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { mkdir } from "shelljs";
import {createWriteStream} from "fs";

/**
 * prepare directory for specified file.
 * @param filePath
 */
function prepareDirForFile(filePath: string) {
  let dirName = path.dirname(filePath);
  try {
    mkdir("-p", dirName);
  } catch (error) {
    console.log(error);
    return false;
  }
  return true;
}

/**
 * Fetch file to specified local folder
 * @param fileURL
 * @param dest
 */
function fetchAndSaveFile(fileURL, dest) {
  return new Promise((resolve, reject) => {
    const timeout = 10000;
    const urlParsed = url.parse(fileURL);
    const uri = urlParsed.pathname.split("/");

    let req;
    let filename = uri[uri.length - 1].match(/(\w*\.?-?)+/)[0];

    if (urlParsed.protocol === null) {
      fileURL = "http://" + fileURL;
    }

    req = urlParsed.protocol === "https:" ? https : http;

    let request = req
      .get(fileURL, response => {
        // Make sure extension is present (mostly for images)
        if (filename.indexOf(".") < 0) {
          const contentType = response.headers["content-type"];
          filename += `.${contentType.split("/")[1]}`;
        }

        const targetPath = `${dest}/${filename}`;

        response.on("end", function() {
          resolve(`File "${filename}" downloaded successfully.`);
        });

        if (response.statusCode === 200) {
          if (prepareDirForFile(targetPath)) {
            var file = createWriteStream(targetPath);
            response.pipe(file);
          } else {
            reject("Make folder failed:" + dest);
          }
        } else {
          reject(`Downloading ${fileURL} failed`);
        }
      }).setTimeout(timeout, () => {
        request.abort();
        reject(`Request Timeout(${timeout} ms):Download ${fileURL} failed!`);
      })
      .on("error", e => {
        reject(`Downloading ${fileURL} failed! Please make sure URL is valid.`);
      });
  });
}

export { prepareDirForFile, fetchAndSaveFile };
