import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { Predefine } from "../../src/predefine";

const isWindows = process.platform === "win32";

function remote(p: string): vscode.Uri {
  return vscode.Uri.parse(`vscode-remote://wsl+Ubuntu${p}`);
}

suite("Predefine (remote)", () => {
  const doc = remote("/home/me/proj/exercise/nb.md");
  const ws = remote("/home/me/proj");
  const predefine = new Predefine(doc, ws);

  test("keeps remote paths posix instead of fsPath", () => {
    assert.strictEqual(predefine.filePath(), "/home/me/proj/exercise/nb.md");
    assert.strictEqual(
      predefine.fileDirname(),
      "/home/me/proj/exercise",
      "the WSL bug came from path.dirname(uri.fsPath)"
    );
    assert.strictEqual(predefine.fileBasename(), "nb.md");
    assert.strictEqual(predefine.fileBasenameNoExtension(), "nb");
    assert.strictEqual(predefine.fileExtname(), ".md");
    assert.strictEqual(predefine.fileWorkspaceFolder(), "/home/me/proj");
    assert.strictEqual(predefine.workspaceRoot(), "/home/me/proj");
    assert.strictEqual(predefine.workspaceFolderBasename(), "proj");
    assert.strictEqual(predefine.relativeFileDirname(), "exercise");
  });

  test("slices remote paths like the local ones", () => {
    assert.strictEqual(predefine.filePath("-1"), "nb.md");
    assert.strictEqual(predefine.fileDirname(), "/home/me/proj/exercise");
    assert.strictEqual(predefine.relativeFileDirname("-1"), "exercise");
    assert.strictEqual(
      predefine.filePath("0:3"),
      "/home/me",
      "root must not be duplicated or lost when slicing"
    );
  });

  test("predefined variables expand to remote paths", () => {
    const expanded = Predefine.replaceRegPredefinedVars(
      "${fileDirname}/images",
      predefine
    );
    assert.strictEqual(expanded, "/home/me/proj/exercise/images");

    const withName = Predefine.replaceRegPredefinedVars(
      "${relativeFileDirname}/${fileBasenameNoExtension}",
      predefine
    );
    assert.strictEqual(withName, "exercise/nb");
  });

  test("files at the workspace root have no relative dirname", () => {
    const rootDoc = remote("/home/me/proj/index.md");
    const p = new Predefine(rootDoc, ws);
    assert.strictEqual(p.relativeFileDirname(), "");
  });
});

suite("Predefine (local)", () => {
  test("local paths keep the platform dialect", () => {
    const root = path.join("tmp", "mdpaste_predefine_local");
    const file = path.join(root, "src", "a b.md");
    const doc = vscode.Uri.file(file);
    const ws = vscode.Uri.file(root);
    const p = new Predefine(doc, ws);

    const expectedDir = vscode.Uri.file(path.join(root, "src"));
    const expectedDirDisplay = expectedDir.fsPath
      .replace(/\\/g, "/")
      .replace(/^([a-zA-Z]):/, (_, d: string) => d.toUpperCase() + ":");

    assert.strictEqual(p.fileDirname(), expectedDirDisplay);
    assert.strictEqual(p.fileBasename(), "a b.md");
    assert.strictEqual(p.fileBasenameNoExtension(), "a b");
    assert.strictEqual(p.fileExtname(), ".md");
    assert.strictEqual(p.relativeFileDirname(), "src");
    assert.strictEqual(p.workspaceFolderBasename(), "mdpaste_predefine_local");
    if (isWindows) {
      assert.ok(
        !p.fileDirname().includes("\\"),
        "display paths must use forward slashes"
      );
    }
  });
});
