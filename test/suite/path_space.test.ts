import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  getPathSpace,
  implFor,
  toDisplayPath,
  normalizeDisplay,
  resolveDisplayPath,
  stripQueryAndFragment,
  fromDisplayPath,
  isRemoteUri,
  wslUncCandidates,
  dirnameOf,
} from "../../src/path_space";

const isWindows = process.platform === "win32";

function remoteUri(p: string, fragment = ""): vscode.Uri {
  return vscode.Uri.parse(`vscode-remote://wsl+Ubuntu${p}${fragment}`);
}

suite("path_space", () => {
  suite("getPathSpace", () => {
    test("file scheme follows the extension host platform", () => {
      const uri = vscode.Uri.file(path.join("tmp", "a.md"));
      assert.strictEqual(getPathSpace(uri), isWindows ? "win32" : "posix");
    });

    test("remote schemes are posix", () => {
      assert.strictEqual(getPathSpace(remoteUri("/home/u/a.md")), "posix");
      assert.strictEqual(
        getPathSpace(
          vscode.Uri.parse("vscode-remote://ssh-remote+host/c:/a.md")
        ),
        "posix"
      );
    });

    test("untitled is posix", () => {
      assert.strictEqual(
        getPathSpace(vscode.Uri.parse("untitled:Untitled-1")),
        "posix"
      );
    });
  });

  suite("toDisplayPath", () => {
    test("decodes remote paths and drops fsPath translation", () => {
      const uri = remoteUri("/home/u/my%20proj/a%23b.md");
      assert.strictEqual(toDisplayPath(uri), "/home/u/my proj/a#b.md");
    });

    test("remote windows drive paths stay provider-shaped", () => {
      const uri = vscode.Uri.parse(
        "vscode-remote://ssh-remote+win/c:/proj/a.md"
      );
      assert.strictEqual(toDisplayPath(uri), "/c:/proj/a.md");
    });

    test("local windows paths use forward slashes", () => {
      if (!isWindows) return;
      const uri = vscode.Uri.file("C:/Users/me/a b.md");
      // `uri.fsPath` lower-cases the drive letter; the display form keeps it.
      assert.strictEqual(toDisplayPath(uri), "c:/Users/me/a b.md");
    });

    test("local posix paths are unchanged", () => {
      if (isWindows) return;
      const uri = vscode.Uri.file("/home/me/a b.md");
      assert.strictEqual(toDisplayPath(uri), "/home/me/a b.md");
    });
  });

  suite("normalizeDisplay / resolveDisplayPath", () => {
    test("collapses separators and dot segments per space", () => {
      assert.strictEqual(
        normalizeDisplay("/home/u/./proj/../proj/images/a.png", "posix"),
        "/home/u/proj/images/a.png"
      );
      assert.strictEqual(
        normalizeDisplay("C:\\Users\\me\\..\\me\\images\\a.png", "win32"),
        "C:/Users/me/images/a.png"
      );
    });

    test("resolves relative paths against the base dir", () => {
      assert.strictEqual(
        resolveDisplayPath("/home/u/proj/exercise", "posix", "images/a.png"),
        "/home/u/proj/exercise/images/a.png"
      );
      assert.strictEqual(
        resolveDisplayPath("/home/u/proj/exercise", "posix", "../shared/a.png"),
        "/home/u/proj/shared/a.png"
      );
      assert.strictEqual(
        resolveDisplayPath("/home/u/proj/exercise", "posix", "/tmp/a.png"),
        "/tmp/a.png"
      );
      assert.strictEqual(
        resolveDisplayPath("C:/Users/me/proj", "win32", "images/a.png"),
        "C:/Users/me/proj/images/a.png"
      );
      assert.strictEqual(
        resolveDisplayPath("C:/Users/me/proj", "win32", "D:/img/a.png"),
        "D:/img/a.png"
      );
    });
  });

  suite("stripQueryAndFragment", () => {
    test("removes the width/height query", () => {
      const uri = vscode.Uri.parse("file:///c:/proj/a.png?100,60");
      const stripped = stripQueryAndFragment(uri);
      assert.strictEqual(stripped.query, "");
      assert.strictEqual(stripped.fsPath, uri.fsPath);
    });

    test("removes the notebook cell fragment", () => {
      const doc = remoteUri("/home/u/nb.ipynb", "#W0sZmlsZQ%3D%3D");
      const stripped = stripQueryAndFragment(doc);
      assert.strictEqual(stripped.fragment, "");
      assert.strictEqual(stripped.path, "/home/u/nb.ipynb");
    });
  });

  suite("fromDisplayPath", () => {
    test("keeps scheme and authority for remote documents", () => {
      const doc = remoteUri("/home/u/proj/a.md");
      const target = fromDisplayPath(doc, "/home/u/proj/images/fig 1.png");
      assert.strictEqual(target.scheme, "vscode-remote");
      assert.strictEqual(target.authority, "wsl+Ubuntu");
      assert.strictEqual(target.path, "/home/u/proj/images/fig 1.png");
      assert.strictEqual(target.query, "");
      assert.strictEqual(target.fragment, "");
    });

    test("never inherits the notebook fragment of the document", () => {
      const doc = remoteUri("/home/u/nb.ipynb", "#W0sZmlsZQ%3D%3D");
      const target = fromDisplayPath(doc, "/home/u/images/a.png");
      assert.strictEqual(target.fragment, "");
      assert.strictEqual(target.path, "/home/u/images/a.png");
    });

    test("remote windows drive paths are kept verbatim", () => {
      const doc = vscode.Uri.parse(
        "vscode-remote://ssh-remote+win/c:/proj/a.md"
      );
      const target = fromDisplayPath(doc, "/c:/proj/images/a.png");
      assert.strictEqual(target.authority, "ssh-remote+win");
      assert.strictEqual(target.path, "/c:/proj/images/a.png");
    });

    test("honours explicit schemes", () => {
      const doc = remoteUri("/home/u/a.md");
      const target = fromDisplayPath(doc, "file:///c:/tmp/a.png");
      assert.strictEqual(target.scheme, "file");
    });

    test("local drive paths become file uris", () => {
      if (!isWindows) return;
      const doc = vscode.Uri.file("C:/Users/me/a.md");
      const target = fromDisplayPath(doc, "D:/img/a.png");
      assert.strictEqual(target.scheme, "file");
      assert.strictEqual(target.fsPath.toLowerCase(), "d:\\img\\a.png");
    });

    test("local unc paths keep the server as authority", () => {
      if (!isWindows) return;
      const doc = vscode.Uri.file("C:/Users/me/a.md");
      const target = fromDisplayPath(doc, "//server/share/a.png");
      assert.strictEqual(target.scheme, "file");
      assert.strictEqual(target.authority, "server");
      assert.strictEqual(target.path, "/share/a.png");
    });
  });

  suite("wslUncCandidates", () => {
    test("maps wsl remotes to both unc prefixes on windows", () => {
      const got = wslUncCandidates("wsl+Ubuntu", "/home/u/proj/x.png");
      if (!isWindows) {
        assert.deepStrictEqual(got, []);
        return;
      }
      assert.deepStrictEqual(got, [
        "\\\\wsl.localhost\\Ubuntu\\home\\u\\proj\\x.png",
        "\\\\wsl$\\Ubuntu\\home\\u\\proj\\x.png",
      ]);
    });

    test("returns nothing for non-wsl authorities", () => {
      assert.deepStrictEqual(
        wslUncCandidates("ssh-remote+host", "/home/u/x.png"),
        []
      );
      assert.deepStrictEqual(wslUncCandidates(undefined, "/home/u/x.png"), []);
      assert.deepStrictEqual(wslUncCandidates("wsl+", "/home/u/x.png"), []);
    });
  });

  suite("helpers", () => {
    test("isRemoteUri", () => {
      assert.strictEqual(isRemoteUri(remoteUri("/home/u/a.md")), true);
      assert.strictEqual(isRemoteUri(vscode.Uri.file("/tmp/a.md")), false);
    });

    test("dirnameOf", () => {
      assert.strictEqual(
        dirnameOf(remoteUri("/home/u/proj/a.md")),
        "/home/u/proj"
      );
      if (isWindows) {
        assert.strictEqual(
          dirnameOf(vscode.Uri.file("C:/Users/me/a.md")),
          "c:/Users/me"
        );
      }
    });

    test("implFor delegates to the matching path flavour", () => {
      assert.strictEqual(
        implFor("posix").join("/home/u", "images", "a.png"),
        "/home/u/images/a.png"
      );
      assert.strictEqual(
        implFor("win32").basename("C:/Users/me/images/a.png"),
        "a.png"
      );
      assert.strictEqual(
        implFor("win32")
          .relative("C:/Users/me", "C:/Users/me/images/a.png")
          .replace(/\\/g, "/"),
        "images/a.png"
      );
    });
  });
});
