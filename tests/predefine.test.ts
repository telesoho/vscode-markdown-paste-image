jest.unmock("../src/predefine");
jest.useFakeTimers().setSystemTime(new Date("2023-03-19T18:00:00.000"));
import * as vscode from "vscode";
import { Predefine } from "../src/predefine";

// Defines a Mocha test suite to group tests of similar kind together
describe("Predefines test", () => {
  const mockSummaryChannel = {
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
  } as any;
  const setupWorkspace = (active: string, ...additional: string[]) => {
    const folders = [active, ...additional].map((ws) => ({
      name: ws,
      uri: { fsPath: ws },
    }));
    (vscode.workspace as any).workspaceFolders = folders;
    (vscode.window.activeTextEditor as any) = {
      document: {
        uri: { fsPath: "testSource1/whatever.test.md" },
        getText: jest
          .fn()
          .mockReturnValueOnce("selected*abc")
          .mockReturnValue("selected text"),
      },
      selection: {},
    };
    vscode.workspace.getWorkspaceFolder = jest.fn().mockReturnValue(folders[0]);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    vscode.window.createOutputChannel = jest.fn(() => mockSummaryChannel);
    setupWorkspace("testSource1", "testSource2");
  });

  it("Predefines", () => {
    const predefine = new Predefine();
    expect(predefine.datetime()).toBe("20230319180000");
    expect(predefine.workspaceRoot()).toBe("testSource1");
    expect(predefine.file()).toBe("testSource1/whatever.test.md");
    expect(predefine.fileBasename()).toBe("whatever.test.md");
    expect(predefine.fileBasenameNoExtension()).toBe("whatever.test");
    expect(predefine.fileDirname()).toBe("testSource1");
    expect(predefine.filePath()).toBe("testSource1/whatever.test.md");
    expect(predefine.fileWorkspaceFolder()).toBe("testSource1");
    expect(predefine.relativeFileDirname()).toBe("");
    expect(predefine.workspaceFolder()).toBe("testSource1");
    expect(predefine.workspaceFolderBasename()).toBe("testSource1");
    expect(predefine.selectedText()).toBe("");
    expect(predefine.selectedText()).toBe("selected text");
  });
});
