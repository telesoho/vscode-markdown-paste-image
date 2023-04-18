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

// IMPORTANCE Don't Use await/async, It will cause some unkown Error.
suite("Shell Tests", () => {
  test("get clipboard type test text", () => {
    shell.setTextToClipboard(test_text).then(() => {
      shell.getClipboardContentType().then((val) => {
        assert.strictEqual(val, shell.ClipboardType.Text);
      });
    });
  });
  test("get clipboard type test html", () => {
    shell.setHtmlToClipboard(test_html).then(() => {
      shell.getClipboardContentType().then((val) => {
        assert.strictEqual(val, shell.ClipboardType.Html);
      });
    });
  });
  test("get clipboard type test png", () => {
    shell.setImageToClipboard(test_png).then(() => {
      shell.getClipboardContentType().then((val) => {
        assert.strictEqual(val, shell.ClipboardType.Image);
      });
    });
  });

  test("get clipboard content test plain text", () => {
    shell.setTextToClipboard(test_text).then(() => {
      shell.getClipboardTextPlain().then((text) => {
        const text_content = fs.readFileSync(test_text, "utf8");
        assert.strictEqual(text, text_content.trim());
      });
    });
  });

  test("get clipboard content test html", () => {
    shell.setHtmlToClipboard(test_html).then(() => {
      shell.getClipboardTextHtml().then((html) => {
        const html_content = fs.readFileSync(test_html, "utf8");
        assert.strictEqual(html, html_content.trim());
      });
    });
  });

  test("get clipboard content test png", () => {
    shell.setImageToClipboard(test_png).then(() => {
      const png_content = fs.readFileSync(test_png).toString("base64");

      const tmpfile = utils.newTemporaryFilename();
      utils.prepareDirForFile(tmpfile.fsPath);

      shell
        .saveClipboardImageToFileAndGetPath(tmpfile.fsPath)
        .then((png_file) => {
          assert.notStrictEqual(png_file, undefined);
          if (png_file) {
            const png_content_pasted = fs
              .readFileSync(png_file)
              .toString("base64");
            assert.strictEqual(png_content_pasted, png_content);
          }
        });
    });
  });
});
