import execa from "execa";
import path from "path";

const xsel = "xsel";
const xselFallback = path.join(__dirname, "../../../res/bin/linux/xsel");

const copyArguments = ["--clipboard", "--input"];
const pasteArguments = ["--clipboard", "--output"];

function makeError(xselError, fallbackError) {
  let error;
  if (xselError.code === "ENOENT") {
    error = new Error(
      "Couldn't find the `xsel` binary and fallback didn't work. On Debian/Ubuntu you can install xsel with: sudo apt install xsel"
    );
  } else {
    error = new Error("Both xsel and fallback failed");
    error.xselError = xselError;
  }

  error.fallbackError = fallbackError;
  return error;
}

async function xselWithFallback(argumentList, options) {
  try {
    const { stdout } = await execa(xsel, argumentList, options);
    return stdout;
  } catch (xselError) {
    try {
      const { stdout } = await execa(xselFallback, argumentList, options);
      return stdout;
    } catch (fallbackError) {
      throw makeError(xselError, fallbackError);
    }
  }
}

function xselWithFallbackSync(argumentList, options) {
  try {
    return execa.sync(xsel, argumentList, options).stdout;
  } catch (xselError) {
    try {
      return execa.sync(xselFallback, argumentList, options).stdout;
    } catch (fallbackError) {
      throw makeError(xselError, fallbackError);
    }
  }
}

async function copy(options) {
  return await xselWithFallback(copyArguments, options);
}

async function paste(options) {
  return await xselWithFallback(pasteArguments, options);
}

function copySync(options) {
  return xselWithFallbackSync(copyArguments, options);
}

function pasteSync(options) {
  return xselWithFallbackSync(pasteArguments, options);
}

export { copy, paste, copySync, pasteSync };
