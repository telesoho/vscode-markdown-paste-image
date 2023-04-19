jest.unmock("../src/Logger");
import Logger from "../src/Logger";
import * as vscode from "vscode";
jest.useFakeTimers().setSystemTime(new Date("2023-03-19T18:00:00.000"));

class DummyVscodeOutputChannel implements vscode.OutputChannel {
  name: string;
  value: string[];
  constructor(name: string) {
    this.name = name;
    this.value = [];
  }
  getValue() {
    return this.value;
  }

  append(value: string): void {
    throw new Error("Method not implemented.");
  }
  appendLine(value: string): void {
    this.value.push(value, "\n");
  }
  replace(value: string): void {
    throw new Error("Method not implemented.");
  }
  clear(): void {
    throw new Error("Method not implemented.");
  }
  show(preserveFocus?: boolean | undefined): void;
  show(
    column?: vscode.ViewColumn | undefined,
    preserveFocus?: boolean | undefined
  ): void;
  show(column?: unknown, preserveFocus?: unknown): void {
    throw new Error("Method not implemented.");
  }
  hide(): void {
    throw new Error("Method not implemented.");
  }
  dispose(): void {
    throw new Error("Method not implemented.");
  }
}

describe("Logger to channel", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it("to apply workspace name for subsequent logger", () => {
    const result = new DummyVscodeOutputChannel("Markdown Paste");
    Logger.channel = result;
    Logger.log("workspace-1");
    expect(result.getValue().join("")).toEqual(
      "[03-19 18:00:00] workspace-1\n"
    );
  });
});
