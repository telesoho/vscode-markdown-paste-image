import * as fs from "fs";
import * as path from "path";

import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

/**
 * VS Code 1.146 renamed the macOS application executable from `Electron` to
 * `Code`. Pick whichever binary exists in the downloaded bundle so the tests
 * keep working with both the old and the new layout.
 */
function resolveMacOSExecutable(bundlePath: string): string {
  const macosDir = path.dirname(bundlePath);
  for (const binary of ["Electron", "Code"]) {
    const candidate = path.join(macosDir, binary);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return bundlePath;
}

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Download VS Code and unzip it. Resolve the executable ourselves because
    // `@vscode/test-electron` still assumes `Contents/MacOS/Electron` on macOS.
    let vscodeExecutablePath = await downloadAndUnzipVSCode();
    if (process.platform === "darwin") {
      vscodeExecutablePath = resolveMacOSExecutable(vscodeExecutablePath);
    }

    // Run the integration test
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions"],
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
