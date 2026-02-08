import path from "path";
import Mocha from "mocha";
import * as fs from "fs";

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, "..");

  try {
    // Find all test files recursively
    function findTestFiles(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          findTestFiles(filePath, fileList);
        } else if (file.endsWith(".test.js")) {
          fileList.push(path.relative(testsRoot, filePath));
        }
      });
      return fileList;
    }

    const files = findTestFiles(testsRoot);

    // Add files to the test suite
    for (const f of files) {
      mocha.addFile(path.resolve(testsRoot, f));
    }

    // Run the mocha test
    return new Promise<void>((c, e) => {
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
