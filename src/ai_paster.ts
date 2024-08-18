import { Paster } from "./paster";
import { Groq } from "groq-sdk";

export interface Message {
  role: "user" | "assistant";
  content: string;
  context?: string;
  formatedContent?: string;
  dateTimestamp?: number;
  readableDateAndTime?: string;
  sessionId?: string;
}

export class AIPaster {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: this.config.aiKey,
    });
  }

  public get config() {
    return Paster.getConfig();
  }

  public async callAI(
    message: string,
    current_messages: Message[] = [],
    model: string = null
  ): Promise<any> {
    if (!this.client) {
      return { status: "error", message: "Client is not initialized" };
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      let _model = model || this.config.aiModel;
      const sysMessage = this.config.aiSysMessage;

      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: sysMessage,
          },
          ...current_messages.map((c) => ({
            role: c.role,
            content: c.content,
          })),
          {
            role: "user",
            content: message,
          },
        ],
        temperature: this.config.aiTemperature,
        top_p: 0.9,
        model: _model,
      });

      return { status: "success", data: completion.choices[0].message.content };
    } catch (error: any) {
      if (error && error.message) {
        console.log(error.message);
        return { status: "error", message: error.message };
      }
      return { status: "error", message: error?.toString() };
    }
  }
}
