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
});
