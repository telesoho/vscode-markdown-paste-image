import * as assert from "assert";
import * as shell from "../../src/shell";
import * as utils from "../../src/utils";
import path from "path";
import * as fs from "fs";

var rewire = require("rewire");
var paster = rewire("../../src/paster.js");
const test_png = path.join(__dirname, `../../res/scripts/test-data/test.png`);
const test_html = path.join(__dirname, `../../res/scripts/test-data/test.html`);
const test_text = path.join(__dirname, `../../res/scripts/test-data/test.txt`);

// Defines a Mocha test suite to group tests of similar kind together
suite("Shell Tests", () => {
  test("get clipboard type test", async () => {
    await shell.setTextToClipboard(test_text);
    assert.strictEqual(
      await shell.getClipboardContentType(),
      shell.ClipboardType.Text
    );
    await shell.setHtmlToClipboard(test_html);
    assert.strictEqual(
      await shell.getClipboardContentType(),
      shell.ClipboardType.Html
    );
    await shell.setImageToClipboard(test_png);
    assert.strictEqual(
      await shell.getClipboardContentType(),
      shell.ClipboardType.Image
    );
  });

  test("get clipboard content test", async () => {
    await shell.setTextToClipboard(test_text);

    const text = await shell.getClipboardTextPlain();
    const text_content = fs.readFileSync(test_text, "utf8");
    assert.strictEqual(text, text_content.trim());

    await shell.setHtmlToClipboard(test_html);

    const html = await shell.getClipboardTextHtml();
    const html_content = fs.readFileSync(test_html, "utf8");
    assert.strictEqual(html, html_content.trim());

    await shell.setImageToClipboard(test_png);
    const png_content = fs.readFileSync(test_png).toString("base64");

    const tmpfile = utils.newTemporaryFilename();
    utils.prepareDirForFile(tmpfile.fsPath);

    const png_file = await shell.saveClipboardImageToFileAndGetPath(
      tmpfile.fsPath
    );
    assert.notStrictEqual(png_file, undefined);
    if (png_file) {
      const png_content_pasted = fs.readFileSync(png_file).toString("base64");
      assert.strictEqual(png_content_pasted, png_content);
    }
  });
});
