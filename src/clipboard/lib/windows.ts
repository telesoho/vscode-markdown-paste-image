import execa from "execa";
import path from "path";
import arch from "arch";

const binarySuffix = arch() === "x64" ? "x86_64" : "i686";

// Binaries from: https://github.com/sindresorhus/win-clipboard
const windowBinaryPath = path.join(
  __dirname,
  `../../../res/bin/windows/clipboard_${binarySuffix}.exe`
);

async function copy(options) {
  return execa(windowBinaryPath, ["--copy"], options);
}

async function paste(options) {
  const { stdout } = await execa(windowBinaryPath, ["--paste"], options);
  return stdout;
}
function copySync(options) {
  return execa.sync(windowBinaryPath, ["--copy"], options);
}
function pasteSync(options) {
  return execa.sync(windowBinaryPath, ["--paste"], options).stdout;
}

export { copy, paste, copySync, pasteSync };
