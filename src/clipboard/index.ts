import * as linux from "./lib/linux";
import * as macos from "./lib/macos";
import * as windows from "./lib/windows";
import isWSL from "is-wsl";

const platformLib = (() => {
  switch (process.platform) {
    case "darwin":
      return macos;
    case "win32":
      return windows;
    default:
      // `process.platform === 'linux'` for WSL.
      if (isWSL) {
        return windows;
      }

      return linux;
  }
})();

async function write(text: string) {
  return platformLib.copy({ input: text });
}

async function read() {
  return platformLib.paste({ stripFinalNewline: false });
}

function writeSync(text: string) {
  return platformLib.copySync({ input: text });
}

function readSync() {
  return platformLib.pasteSync({ stripFinalNewline: false });
}

export { write, read, writeSync, readSync };
