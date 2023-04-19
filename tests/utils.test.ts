jest.unmock("../src/utils");
import * as fs from "fs";
import { tmpdir } from "os";
import * as utils from "../src/utils";

describe("Utils test", () => {
  const httpIncomingMessage = {
    on: jest.fn(),
    pipe: jest.fn().mockReturnThis(),
    statusCode: 200,
    headers: {
      "content-type": "image/png",
    },
  };

  jest.mock("https", () => ({
    ...jest.requireActual("https"), // import and retain the original functionalities
    get: jest.fn().mockImplementation((uri, callback?) => {
      if (callback) {
        callback(httpIncomingMessage);
      }
    }),
  }));

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
