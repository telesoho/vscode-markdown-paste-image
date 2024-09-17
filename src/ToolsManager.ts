import { ChatCompletionTool } from "openai/resources/chat/completions";
import { fetchWeb, htmlToMarkdown } from "./tool_functions";
import Logger from "./Logger";

type FunctionParameters = {
  [x: string]: unknown;
};
type ToolFunction = (...args: any[]) => any;

interface ToolInfo {
  func: ToolFunction;
  description: string;
  parameters: FunctionParameters;
}

export class ToolsManager {
  private tools: Map<string, ToolInfo>;

  constructor() {
    this.tools = new Map();
  }

  public registerDefaultTools() {
    // this.registerTool("fetchWeb", fetchWeb, "fetch a web page content", {
    //   type: "object",
    //   properties: {
    //     url: { type: "string", description: "The url of the web page" },
    //   },
    //   required: ["url"],
    // });
    // this.registerTool(
    //   "htmlToMarkdown",
    //   htmlToMarkdown,
    //   "Conver html to markdown",
    //   {
    //     type: "object",
    //     properties: {
    //       html: { type: "string", description: "html" },
    //     },
    //     required: ["html"],
    //   }
    // );
  }

  public registerTool(
    name: string,
    func: ToolFunction,
    description: string,
    parameters: FunctionParameters
  ) {
    this.tools.set(name, { func, description, parameters });
  }

  public async executeTool(name: string, args: any): Promise<string> {
    const toolInfo = this.tools.get(name);
    if (toolInfo) {
      try {
        return JSON.stringify(await toolInfo.func(args));
      } catch (error) {
        Logger.log(`Error executing tool ${name}:`, error);
        return null;
      }
    } else {
      Logger.log(`Tool ${name} not found`);
      return null;
    }
  }

  public getToolsForOpenAI(): ChatCompletionTool[] {
    return Array.from(this.tools.entries()).map(([toolName, toolInfo]) => ({
      type: "function",
      function: {
        name: toolName,
        description: toolInfo.description,
        parameters: toolInfo.parameters,
      },
    }));
  }
}
