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
import * as myExtension from "../../src/extension";
import * as utils from "../../src/utils";

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {
  // Defines a Mocha unit test
  test("download test", () => {
    let target_file = "out_test/data/abc/test.png";
    if (!utils.prepareDirForFile(target_file)) {
      assert.fail("error", "errora", "prepare dir failed");
    }
    utils
      .fetchAndSaveFile(
        "https://avatars.githubusercontent.com/u/10979091?v=4",
        target_file
      )
      .then((msg) => {
        console.log(msg);
        assert.equal(fs.existsSync(target_file), true);
      })
      .catch((err) => {
        console.log(err);
      });
  });
});
