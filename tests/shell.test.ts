jest.useRealTimers();
jest.unmock("../src/shell");
jest.unmock("../src/utils");
jest.unmock("child_process");
import * as shell from "../src/shell";
import * as fs from "fs";
import * as utils from "../src/utils";
import path from "path";
import { tmpdir } from "os";

const test_png = path.join(__dirname, `./test-data/test.png`);
const test_html = path.join(__dirname, `./test-data/test.html`);
const test_text = path.join(__dirname, `./test-data/test.txt`);

describe("Shell tests", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it("get clipboard type test text", async () => {
    await shell.setTextToClipboard(test_text);
    await shell.getClipboardContentType().then((val) => {
      expect(val).toBe(shell.ClipboardType.Text);
    });
  });
  it("get clipboard type test html", async () => {
    await shell.setHtmlToClipboard(test_html);
    await shell.getClipboardContentType().then((val) => {
      expect(val).toBe(shell.ClipboardType.Html);
    });
  });
  it("get clipboard type test png", async () => {
    await shell.setImageToClipboard(test_png);
    await shell.getClipboardContentType().then((val) => {
      expect(val).toBe(shell.ClipboardType.Image);
    });
  });

  it("get clipboard content test plain text", async () => {
    await shell.setTextToClipboard(test_text);
    await shell.getClipboardTextPlain().then((text) => {
      const text_content = fs.readFileSync(test_text, "utf8");
      expect(text).toBe(text_content);
    });
  });

  it("get clipboard content test html", async () => {
    await shell.setHtmlToClipboard(test_html);
    await shell.getClipboardTextHtml().then((html) => {
      const html_content = fs.readFileSync(test_html, "utf8");
      expect(html).toBe(html_content);
    });
  });
  it("get clipboard content test png", async () => {
    await shell.setImageToClipboard(test_png);
    const png_content = fs.readFileSync(test_png).toString("base64");

    const tmpfile = `${tmpdir()}/shell-test/data/test.png`;
    utils.prepareDirForFile(tmpfile);

    await shell.saveClipboardImageToFileAndGetPath(tmpfile).then((png_file) => {
      expect(png_file).not.toBe(undefined);
      if (png_file) {
        const png_content_pasted = fs.readFileSync(png_file).toString("base64");
        expect(png_content_pasted).toBe(png_content);
      }
    });
  });
});
