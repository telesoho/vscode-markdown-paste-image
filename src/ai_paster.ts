import { Paster } from "./paster";
import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { Predefine } from "./predefine";
import Logger from "./Logger";
import { ToolsManager } from "./ToolsManager";

export class AIPaster {
  private client: OpenAI;
  private toolsManager: ToolsManager;

  constructor() {
    this.client = new OpenAI(this.config.openaiConnectOption);
    this.toolsManager = new ToolsManager();
    this.toolsManager.registerDefaultTools();
  }

  public destructor() {
    delete this.client;
    this.client = null;
  }

  public get config() {
    return Paster.getConfig();
  }

  private async runCompletion(completion) {
    try {
      completion.messages.forEach((message) => {
        Logger.log(
          `Role: ${message.role}, Content: ${
            typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content)
          }`
        );
      });
      const chatCompletion = await this.client.chat.completions.create(
        completion
      );
      const responseMessages = chatCompletion.choices[0].message;
      const toolCalls = chatCompletion.choices[0].message.tool_calls;
      if (toolCalls) {
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionResponse = await this.toolsManager.executeTool(
            functionName,
            JSON.parse(toolCall.function.arguments)
          );
          if (functionResponse !== null) {
            completion.messages.push({
              tool_call_id: toolCall.id,
              role: "tool",
              content: functionResponse,
            });
          }
        }
        completion.messages.forEach((message: ChatCompletionMessageParam) => {
          Logger.log(
            `Role: ${message.role}, Content: ${
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content)
            }`
          );
        });
        const secondResponse = await this.client.chat.completions.create(
          completion
        );

        secondResponse.choices.forEach((choice, index) => {
          Logger.log(choice.message.content);
        });
        return secondResponse.choices[0].message.content;
      }
      return responseMessages.content;
    } catch (error) {
      Logger.log("Error", error);
      throw error;
    }
  }

  private mergeToolsByFunctionName(existingTools, newTools) {
    const toolMap = new Map();

    existingTools.forEach((tool) => toolMap.set(tool.function.name, tool));
    newTools.forEach((tool) => toolMap.set(tool.function.name, tool));

    return Array.from(toolMap.values());
  }

  public async callAI(clipboardText: string): Promise<any> {
    try {
      let openaiCompletionTemplate = this.config.openaiCompletionTemplate;
      try {
        const fs = require("fs");
        const path = require("path");
        const openaiCompletionTemplateFile = path.resolve(
          Predefine.replacePredefinedVars(
            this.config.openaiCompletionTemplateFile
          )
        );
        if (fs.existsSync(openaiCompletionTemplateFile)) {
          openaiCompletionTemplate = JSON.parse(
            fs.readFileSync(openaiCompletionTemplateFile, "utf8")
          );
        }
      } catch (error) {
        Logger.log("Failed to read openaiCompletionTemplate file:", error);
      }

      let result = "";

      await Promise.all(
        openaiCompletionTemplate.map(async (completion: any) => {
          completion.messages.forEach((message: any) => {
            if (Array.isArray(message.content)) {
              message.content = message.content.join("\n");
            }
            if (message.content.includes("{{clipboard_text}}")) {
              message.content = message.content.replace(
                "{{clipboard_text}}",
                clipboardText
              );
            }
          });
          if (completion.tools && Array.isArray(completion.tools)) {
            completion.tools = this.mergeToolsByFunctionName(
              completion.tools,
              this.toolsManager.getToolsForOpenAI()
            );
          } else {
            completion.tools = this.toolsManager.getToolsForOpenAI();
          }
          let content = await this.runCompletion(completion);
          Logger.log("content:", content);
          result += content;
        })
      );

      return { status: "success", message: result };
    } catch (error: any) {
      if (error && error.message) {
        console.log(error.message);
        return { status: "error", message: error.message };
      }
      return { status: "error", message: error?.toString() };
    }
  }
}
