jest.unmock("../src/utils");
import * as fs from "fs";
import { tmpdir } from "os";
import * as utils from "../src/utils";

// Defines a Mocha test suite to group tests of similar kind together
describe("Utils test", () => {
  it("download test", async () => {
    let target_file = `${tmpdir()}/out_test/data/abc/test.png`;
    expect(utils.prepareDirForFile(target_file)).toBe(true);
    await utils
      .fetchAndSaveFile(
        "https://avatars.githubusercontent.com/u/10979091?v=4",
        target_file
      )
      .then((msg) => {
        expect(fs.existsSync(target_file)).toBe(true);
      });
  });
});
