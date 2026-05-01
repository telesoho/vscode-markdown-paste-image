//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import { tmpdir } from "os";
import "../../src/extension";
import { Predefine } from "../../src/predefine";
import * as utils from "../../src/utils";

var rewire = require("rewire");
var paster = rewire("../../src/paster.js");

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {
  // Defines a Mocha unit test
  test("download test", () => {
    let target_file = `${tmpdir()}/out_test/data/abc/test.png`;
    if (!utils.prepareDirForFile(target_file)) {
      assert.fail(`prepare ${target_file} dir failed`);
    }
    utils
      .fetchAndSaveFile(
        "https://avatars.githubusercontent.com/u/10979091?v=4",
        target_file
      )
      .then((msg) => {
        console.log(msg);
        assert.strictEqual(fs.existsSync(target_file), true);
      })
      .catch((err) => {
        console.log(err);
      });
  });
  test("parsePasteImageContext test", () => {
    let ret = paster.Paster.parsePasteImageContext(
      "d:/abc/efg/images/test.png"
    );
    assert.notStrictEqual(ret, null);
    assert.strictEqual(
      "d:/abc/efg/images/test.png",
      paster.Paster.encodePath(ret.targetFile.fsPath)
    );

    ret = paster.Paster.parsePasteImageContext(
      "w:/Source Markdown/Build Ours Blog/images/test.gif"
    );

    // Mock the getConfig method to return encodePath as "encodeSpaceOnly"
    const originalGetConfig = paster.Paster.getConfig;
    paster.Paster.getConfig = function () {
      const config = originalGetConfig.apply(this);
      return {
        ...config,
        encodePath: "encodeSpaceOnly",
      };
    };
    assert.strictEqual(
      "w:/Source%20Markdown/Build%20Ours%20Blog/images/test.gif",
      paster.Paster.encodePath(ret.targetFile.fsPath)
    );

    let imagePath = "w:/Source Markdown/Build Ours Blog/images/test.gif";
    if (imagePath.substring(1, 2) === ":") {
      imagePath = "file:///" + imagePath;
    }
    let targetFile = vscode.Uri.parse(imagePath);
    assert.strictEqual(
      paster.Paster.encodePath(targetFile.fsPath),
      "w:/Source%20Markdown/Build%20Ours%20Blog/images/test.gif"
    );
    paster.Paster.getConfig = originalGetConfig;
    ret = paster.Paster.parsePasteImageContext(
      "d:/Source Markdown/Build Ours Blog/images/"
    );
    assert.strictEqual(ret.convertToBase64, true);
  });
  test("getDimensionProps test", () => {
    let ret = paster.Paster.getDimensionProps(undefined, 200);
    assert.strictEqual(ret, "height='200'");

    ret = paster.Paster.getDimensionProps(200, 200);
    assert.strictEqual(ret, "width='200' height='200'");

    ret = paster.Paster.getDimensionProps(200, undefined);
    assert.strictEqual(ret, "width='200'");
  });
  test("replaceRegPredefinedVars test", () => {
    class PredefineTest extends Predefine {
      public datetime(dateformat: string = "yyyyMMDDHHmmss") {
        return `datetime('${dateformat}')`;
      }

      public workspaceRoot() {
        return "/telesoho/workspaceRoot";
      }

      public filePath() {
        return `${this.fileDirname()}/${this.fileBasename()}`;
      }
      public fileWorkspaceFolder() {
        return "/telesoho/fileWorkspaceFolder";
      }

      public fileBasename(): string {
        return `fileBasenameNoExtension.${this.fileExtname()}`;
      }

      public fileExtname(): string {
        return "fileExtname";
      }

      public fileBasenameNoExtension(): string {
        return "fileBasenameNoExtension";
      }
      public fileDirname(): string {
        return `${this.fileWorkspaceFolder()}/filedir`;
      }
    }
    let predefine = new PredefineTest();
    let str = "";
    let ret_expect = "";
    let ret = "";

    str = "${workspaceRoot},${datetime|aabbccddee},${fileExtname}";
    ret_expect = "/telesoho/workspaceRoot,datetime('aabbccddee'),fileExtname";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${workspaceRoot}";
    ret_expect = "/telesoho/workspaceRoot";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${ workspaceRoot }";
    ret_expect = "/telesoho/workspaceRoot";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${datetime}";
    ret_expect = "datetime('yyyyMMDDHHmmss')";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${ datetime | abc }";
    ret_expect = "datetime(' abc ')";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${ datetime| abc}";
    ret_expect = "datetime(' abc')";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${ datetime|ab c}";
    ret_expect = "datetime('ab c')";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${notExist}";
    ret_expect = "${notExist}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${notExist}";
    ret_expect = "${notExist}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${relativeFileDirname}";
    ret_expect = "filedir";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);

    str = "${workspaceFolderBasename}";
    ret_expect = "fileWorkspaceFolder";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    assert.strictEqual(ret, ret_expect);
  });

  test("Infrastructure: should correctly initialize paths based on platform", () => {
    const isWin = process.platform === "win32";

    const mockFileStr = isWin
      ? "C:\\user\\project\\test\\file.ts"
      : "/user/project/test/file.ts";
    const mockWsStr = isWin ? "C:\\user\\project" : "/user/project";

    const predefine = new Predefine(
      vscode.Uri.file(mockFileStr),
      vscode.Uri.file(mockWsStr)
    );

    console.log(`[Test 1] Platform detected: ${process.platform}`);

    const actualBasename = predefine.fileBasename();
    const actualDirname = predefine.fileDirname();

    // Validate Basename parsing
    if (actualBasename !== "file.ts") {
      throw new Error(
        `[Infrastructure Error] Basename mismatch! Expected "file.ts", but got "${actualBasename}". ` +
          `Check if your mock path format matches the current OS (${process.platform}).`
      );
    }

    // Validate Directory Separator consistency
    if (isWin && !actualDirname.includes("\\")) {
      throw new Error(
        `[Infrastructure Error] Win32 validation failed: Dirname should contain backslashes.`
      );
    }

    if (!isWin && actualDirname.includes("\\")) {
      throw new Error(
        `[Infrastructure Error] POSIX validation failed: Dirname should not contain backslashes.`
      );
    }

    console.log("Environment path initialization passed!");
  });

  test("Predefined variables slicing test", () => {
    const isWindows = process.platform === "win32";
    const filePathStr = isWindows
      ? "C:\\user\\project\\markdown-paste\\test\\suite\\extension.test.ts"
      : "/user/project/markdown-paste/test/suite/extension.test.ts";
    const wsPathStr = isWindows
      ? "C:\\user\\project\\markdown-paste"
      : "/user/project/markdown-paste";

    const mockFile = vscode.Uri.file(filePathStr);
    const mockWs = vscode.Uri.file(wsPathStr);
    console.log(`Debug - mockFile: ${mockFile}`);
    console.log(`Debug - mockWs: ${mockWs}`);
    const predefine = new Predefine(mockFile, mockWs);
    let ret_expect = "";
    let str = "";
    let ret = "";

    // Case 1: Testing negative index to get the last component (the filename)
    str = "${filePath|-1}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    ret_expect = "extension.test.ts";
    console.log(`Debug - Case 1 filePath[-1]: ${ret}`);
    assert.strictEqual(
      ret,
      ret_expect,
      "Case 1: Should return the last part of the path"
    );

    // Case 2: Testing positive index to get the first component
    // Note: On Windows, index 0 is usually C:\
    str = "${filePath|0:2}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    ret_expect = isWindows ? "c:/user" : "/user";
    console.log(`Debug - Case 2 filePath[0:2]: ${ret}`);
    assert.strictEqual(
      ret,
      ret_expect,
      "Should return the first and second part of the path"
    );

    // Case 3: Testing range slicing without step (Python style [:-1])
    // This should return the path components except the last one
    str = "${filePath|:-1}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    console.log(`Debug - Case 3 filePath[:-1]: ${ret}`);
    assert.strictEqual(
      ret.includes("extension.test.ts"),
      false,
      "Should not include the filename"
    );

    // Case 4: Testing full range with specific indices
    str = "${filePath|-3:-1}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    // .replaceRegPredefinedVars() returns "/" uniformly
    ret_expect = isWindows ? "test/suite" : "test/suite";
    console.log(`Debug - Case 4 filePath[-3:-1]: ${ret}`);
    assert.strictEqual(ret, ret_expect);

    // Case 5: Folder test
    str = "${fileWorkspaceFolder|-1}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    ret_expect = "markdown-paste";
    console.log(`Debug - Case 5 fileWorkspaceFolder[-1]: ${ret}`);
    assert.strictEqual(ret, ret_expect);

    str = "${relativeFileDirname|-2}";
    ret = Predefine.replaceRegPredefinedVars(str, predefine);
    ret_expect = "test";
    console.log(`Debug - Case 5 relativeFileDirname[-2]: ${ret}`);
    assert.strictEqual(ret, ret_expect);
  });
});
