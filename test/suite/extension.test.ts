//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

import * as fs from "fs";
import * as utils from "../../src/utils";

var rewire = require("rewire");
var paster = rewire("../../src/paster.js");

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
  test("parsePasteImageContext test", () => {
    let ret = paster.Paster.parsePasteImageContext(
      "d:/abc/efg/images/test.png"
    );
    assert.notStrictEqual(ret, null);
    assert.strictEqual("d:/abc/efg/images/test.png", ret.targetFile.fsPath);

    ret = paster.Paster.parsePasteImageContext(
      "w:/Source Markdown/Build Ours Blog/images/test.gif"
    );
    assert.notStrictEqual(ret, null);
    assert.strictEqual(
      "w:/Source Markdown/Build Ours Blog/images/test.gif",
      ret.targetFile.fsPath
    );
  });
});
