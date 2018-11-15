//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as fs from "fs";
import * as vscode from "vscode";
import * as myExtension from "../src/extension";
import * as utils from "../src/utils";

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {
  // Defines a Mocha unit test
  test("download test", () => {
    if (!utils.prepareDirForFile("out/test/data/abc/test.jpg")) {
      assert.fail("error", "errora", "prepare dir failed");
    }
    utils
      .fetchAndSaveFile(
        "https://www.google.co.jp/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
        "out/test/data/abc"
      )
      .then(msg => {
        console.log(msg);
        assert.equal(
          fs.existsSync("out/test/data/abc/googlelogo_color_272x92dp.png"),
          true
        );
      })
      .catch(err => {
        console.log(err);
      });
  });
});
