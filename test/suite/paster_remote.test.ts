import * as assert from "assert";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import Logger from "../../src/Logger";

/* eslint-disable @typescript-eslint/no-explicit-any */
const paster: any = require("../../src/paster.js");
const Paster: any = paster.Paster;
const xclipModule: any = require("xclip");
const osModule: any = require("os");

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5,
]);

const repoRoot = path.resolve(__dirname, "../../..");
const testTmpRoot = path.join(repoRoot, "out_test", ".tmp");

type Write = { uri: vscode.Uri; bytes: Uint8Array };

type Capture = {
  edits: string[];
  errors: string[];
  infos: string[];
  clipboard: { calls: string[]; noImage: boolean; fail: boolean };
  fsState: {
    dirs: string[];
    writes: Write[];
    store: Map<string, Uint8Array>;
    writeError?: Error;
    statError?: Error;
    readError?: Error;
  };
};

type MockOptions = {
  docUri?: vscode.Uri;
  /** `MarkdownPaste.path` value. */
  imagePath?: string;
};

function remoteUri(pathname: string): vscode.Uri {
  return vscode.Uri.parse(`vscode-remote://wsl+Ubuntu${pathname}`);
}

function patch(target: any, key: string, value: any): () => void {
  const own = Object.getOwnPropertyDescriptor(target, key);
  try {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  } catch {
    target[key] = value;
  }
  return () => {
    try {
      if (own) Object.defineProperty(target, key, own);
      else Reflect.deleteProperty(target, key);
    } catch {
      /* ignore */
    }
  };
}

async function withMocks(
  options: MockOptions,
  run: (capture: Capture) => Promise<void> | void
): Promise<Capture> {
  fs.rmSync(testTmpRoot, { recursive: true, force: true });
  fs.mkdirSync(testTmpRoot, { recursive: true });

  const capture: Capture = {
    edits: [],
    errors: [],
    infos: [],
    clipboard: { calls: [], noImage: false, fail: false },
    fsState: {
      dirs: [],
      writes: [],
      store: new Map(),
    },
  };

  const cleanups: Array<() => void> = [];

  const editor = {
    document: {
      uri: options.docUri ?? remoteUri("/home/me/proj/exercise/note.md"),
      languageId: "markdown",
      getText: () => "",
    },
    selection: new vscode.Selection(0, 0, 0, 0),
    edit: async (callback: (builder: any) => void) => {
      callback({
        insert: (_position: any, text: string) => capture.edits.push(text),
        replace: (_selection: any, text: string) => capture.edits.push(text),
      });
      return true;
    },
  };

  cleanups.push(
    patch(
      vscode.window,
      "activeTextEditor",
      editor as unknown as vscode.TextEditor
    )
  );

  // Local staging happens in a place the test process may write to.
  cleanups.push(patch(osModule, "tmpdir", () => testTmpRoot));

  // Clipboard helper: behaves like the native one and reports through `calls`.
  cleanups.push(
    patch(xclipModule, "getShell", () => ({
      getClipboard: () => ({
        getImage: async (filePath: string) => {
          capture.clipboard.calls.push(filePath);
          if (capture.clipboard.fail) throw new Error("clipboard failure");
          if (capture.clipboard.noImage) return "no image";
          const isUnc = /^\\\\/.test(filePath);
          if (!isUnc) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, pngBytes);
          }
          return filePath;
        },
      }),
    }))
  );

  // The file system provider of the document: local writes are simulated too.
  const fakeFs = {
    createDirectory: async (uri: vscode.Uri) => {
      capture.fsState.dirs.push(uri.toString());
    },
    writeFile: async (uri: vscode.Uri, bytes: Uint8Array) => {
      if (capture.fsState.writeError) throw capture.fsState.writeError;
      capture.fsState.writes.push({ uri, bytes });
      capture.fsState.store.set(uri.toString(), bytes);
    },
    readFile: async (uri: vscode.Uri) => {
      if (capture.fsState.readError) throw capture.fsState.readError;
      const stored = capture.fsState.store.get(uri.toString());
      if (stored) return stored;
      if (uri.scheme === "file") {
        return new Uint8Array(fs.readFileSync(uri.fsPath));
      }
      throw new Error("ENOENT: " + uri.toString());
    },
    stat: async (_uri: vscode.Uri) => {
      if (capture.fsState.statError) throw capture.fsState.statError;
      return { type: 1, ctime: 0, mtime: 0, size: pngBytes.length };
    },
  };
  cleanups.push(patch(vscode.workspace, "fs", fakeFs));

  cleanups.push(
    patch(Paster, "getConfig", () => ({
      path: options.imagePath ?? "${fileDirname}/images",
      basePath: "",
      namePrefix: "figure",
      nameBase: "-1",
      nameSuffix: "",
      encodePath: "none",
      img_alt: "",
      alt: "",
      silence: true,
      applyAllRules: false,
      rules: [],
      lang_rules: [],
      imageRules: undefined,
    }))
  );
  cleanups.push(patch(Paster, "getMatchingImageRule", () => null));
  cleanups.push(patch(Paster, "parse_rules", () => null));
  cleanups.push(patch(Paster, "getAltText", () => ""));
  cleanups.push(
    patch(Logger, "showErrorMessage", (message: string) => {
      capture.errors.push(message);
      return Promise.resolve(undefined as any);
    })
  );
  cleanups.push(
    patch(Logger, "showInformationMessage", (message: string) => {
      capture.infos.push(message);
      return Promise.resolve(undefined as any);
    })
  );

  cleanups.push(
    patch(vscode.window, "showInformationMessage", (message: string) => {
      capture.infos.push(message);
      return Promise.resolve(undefined as any);
    })
  );
  cleanups.push(
    patch(vscode.window, "showErrorMessage", (message: string) => {
      capture.errors.push(message);
      return Promise.resolve(undefined as any);
    })
  );

  try {
    await run(capture);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
  return capture;
}

function tempEntries(): string[] {
  return fs.existsSync(testTmpRoot) ? fs.readdirSync(testTmpRoot) : [];
}

suite("Paster (remote documents)", () => {
  test("keeps the remote scheme and authority when parsing the target path", async () => {
    const notebook = vscode.Uri.parse(
      "vscode-remote://wsl+Ubuntu/home/me/proj/exercise/nb.ipynb#W0sZmlsZQ%3D%3D"
    );
    await withMocks({ docUri: notebook }, () => {
      const context = Paster.parsePasteImageContext(
        "${fileDirname}/images/figure-1.png"
      );
      assert.ok(context);
      assert.strictEqual(context.targetFile.scheme, "vscode-remote");
      assert.strictEqual(context.targetFile.authority, "wsl+Ubuntu");
      assert.strictEqual(
        context.targetFile.path,
        "/home/me/proj/exercise/images/figure-1.png"
      );
      // The notebook cell fragment must never reach the file system.
      assert.strictEqual(context.targetFile.fragment, "");
      assert.strictEqual(context.targetFile.query, "");
    });
  });

  test("generates remote targets and posix markdown links", async () => {
    await withMocks({}, () => {
      const target = Paster.genTargetImage(".png");
      assert.ok(target);
      assert.strictEqual(
        target.display,
        "/home/me/proj/exercise/images/figure-1.png"
      );
      assert.strictEqual(target.uri.scheme, "vscode-remote");
      assert.strictEqual(target.uri.authority, "wsl+Ubuntu");
      assert.strictEqual(
        target.uri.path,
        "/home/me/proj/exercise/images/figure-1.png"
      );

      const link = Paster.renderMdFilePath({
        targetFile: target.uri,
        convertToBase64: false,
        removeTargetFileAfterConvert: false,
      });
      assert.strictEqual(link, "![](images/figure-1.png)");
    });
  });

  test("stages the clipboard image locally and writes through the provider", async () => {
    const capture = await withMocks({}, async (state) => {
      // A provider without stat support forces the generic transfer path.
      state.fsState.statError = new Error("not supported");
      await Paster.saveImage("/home/me/proj/exercise/images/figure-1.png");
    });

    // The direct UNC probe is tried first (and fails), then the staging file.
    const stagingCall =
      capture.clipboard.calls[capture.clipboard.calls.length - 1];
    assert.ok(
      stagingCall.startsWith(testTmpRoot),
      `clipboard helper should read into the local temp dir, got ${stagingCall}`
    );

    assert.strictEqual(capture.fsState.writes.length, 1);
    const write = capture.fsState.writes[0];
    assert.strictEqual(write.uri.scheme, "vscode-remote");
    assert.strictEqual(write.uri.authority, "wsl+Ubuntu");
    assert.strictEqual(
      write.uri.path,
      "/home/me/proj/exercise/images/figure-1.png"
    );
    assert.ok(Buffer.from(write.bytes).equals(pngBytes));
    assert.deepStrictEqual(capture.edits, ["![](images/figure-1.png)"]);
    assert.deepStrictEqual(tempEntries(), [], "the temp dir should be removed");
  });

  test("writes wsl targets through the unc share when the probe succeeds", async () => {
    const capture = await withMocks({}, async () => {
      await Paster.saveImage("/home/me/proj/exercise/images/figure-1.png");
    });

    assert.strictEqual(capture.clipboard.calls.length, 1);
    assert.strictEqual(
      capture.clipboard.calls[0],
      "\\\\wsl.localhost\\Ubuntu\\home\\me\\proj\\exercise\\images\\figure-1.png"
    );
    assert.strictEqual(
      capture.fsState.writes.length,
      0,
      "the fast path must not transfer bytes"
    );
    assert.deepStrictEqual(capture.edits, ["![](images/figure-1.png)"]);
  });

  test("reports a failure instead of touching the document when the write is rejected", async () => {
    const capture = await withMocks({}, async (state) => {
      state.fsState.statError = new Error("not supported");
      state.fsState.writeError = new Error("permission denied");
      await Paster.saveImage("/home/me/proj/exercise/images/figure-1.png");
    });

    assert.deepStrictEqual(capture.edits, []);
    assert.ok(
      capture.errors.some((message) =>
        message.includes("Failed to save the pasted image")
      ),
      `expected an error message, got ${JSON.stringify(capture.errors)}`
    );
    assert.ok(
      capture.errors.join(" ").includes("permission denied"),
      `the provider error should be surfaced, got ${JSON.stringify(
        capture.errors
      )}`
    );
    assert.deepStrictEqual(tempEntries(), []);
  });

  test("does nothing when the clipboard holds no image", async () => {
    const capture = await withMocks({}, async (state) => {
      state.clipboard.noImage = true;
      await Paster.saveImage("/home/me/proj/exercise/images/figure-1.png");
    });

    assert.strictEqual(capture.fsState.writes.length, 0);
    assert.deepStrictEqual(capture.edits, []);
    assert.ok(
      capture.infos.some((message) => message.includes("not an image")),
      `expected an information message, got ${JSON.stringify(capture.infos)}`
    );
  });

  test("inlines remote images in base64 mode and cleans the staging file", async () => {
    const notebook = vscode.Uri.parse(
      "vscode-remote://wsl+Ubuntu/home/me/proj/exercise/nb.ipynb#W0sZmlsZQ%3D%3D"
    );
    const capture = await withMocks({ docUri: notebook }, async () => {
      // A trailing separator asks for a base64 data uri.
      await Paster.saveImage("docs/");
    });

    assert.deepStrictEqual(capture.edits, [
      `![](data:image/png;base64,${pngBytes.toString("base64")})`,
    ]);
    assert.deepStrictEqual(tempEntries(), []);
  });

  test("downloads through the provider as well", async () => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(pngBytes);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const capture = await withMocks({}, async () => {
        await Paster.downloadFile(
          `http://127.0.0.1:${port}/img`,
          "/home/me/proj/exercise/images/downloaded"
        );
      });

      assert.strictEqual(capture.fsState.writes.length, 1);
      const write = capture.fsState.writes[0];
      assert.strictEqual(write.uri.scheme, "vscode-remote");
      assert.strictEqual(write.uri.authority, "wsl+Ubuntu");
      assert.strictEqual(
        write.uri.path,
        "/home/me/proj/exercise/images/downloaded.png"
      );
      assert.ok(Buffer.from(write.bytes).equals(pngBytes));
      assert.deepStrictEqual(capture.edits, ["![](images/downloaded.png)"]);
      assert.deepStrictEqual(tempEntries(), []);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  test("links a pasted path that exists on the remote file system", async () => {
    const restoreFolders = patch(vscode.workspace, "workspaceFolders", [
      { uri: remoteUri("/home/me/proj"), name: "proj", index: 0 },
    ]);
    try {
      await withMocks({}, async () => {
        const markdown = await Paster.parse("pics/diagram.png");
        assert.strictEqual(markdown, "![](pics/diagram.png)");
      });
    } finally {
      restoreFolders();
    }
  });

  test("leaves pasted paths outside the workspace untouched", async () => {
    const restoreFolders = patch(vscode.workspace, "workspaceFolders", [
      { uri: remoteUri("/home/me/proj"), name: "proj", index: 0 },
    ]);
    try {
      await withMocks({}, async () => {
        const markdown = await Paster.parse("/home/me/other/diagram.png");
        assert.strictEqual(markdown, "/home/me/other/diagram.png");
      });
    } finally {
      restoreFolders();
    }
  });
});
