import * as vscode from "vscode";
import * as moment from "moment";

export default class Logger {
  static channel: vscode.OutputChannel;

  static log(...message: any[]) {
    if (this.channel) {
      let time = moment().format("MM-DD HH:mm:ss");
      for (let m of message) {
        let logmsg = `[${time}] ${m}`
        this.channel.appendLine(logmsg);
        console.log(logmsg)
      }
    }
  }

  static showInformationMessage(
    message: string,
    ...items: string[]
  ): Thenable<string> {
    this.log(message);
    return vscode.window.showInformationMessage(message, ...items);
  }

  static showErrorMessage(
    message: string,
    ...items: string[]
  ): Thenable<string> {
    this.log(message);
    return vscode.window.showErrorMessage(message, ...items);
  }
}
