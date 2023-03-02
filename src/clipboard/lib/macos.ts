import execa from "execa";

const env = Object.assign({}, process.env, { LC_CTYPE: "UTF-8" });

async function copy(options) {
  return execa("pbcopy", { ...options, env });
}

async function paste(options) {
  const { stdout } = await execa("pbpaste", { ...options, env });
  return stdout;
}

function copySync(options) {
  return execa.sync("pbcopy", { ...options, env });
}

function pasteSync(options) {
  return execa.sync("pbpaste", { ...options, env }).stdout;
}

export { copy, paste, copySync, pasteSync };
