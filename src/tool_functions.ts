import axios from "axios";
import { toMarkdown } from "./toMarkdown";
import { Paster } from "./paster";
import Logger from "./Logger";
import * as HTMLParser from "node-html-parser";

export async function fetchWeb({ url }: { url: string }): Promise<any> {
  try {
    const response = await axios.get(url);
    let html = HTMLParser.parse(response.data);
    const body = html.querySelector("body").toString();
    const title = html.querySelector("title").toString();
    return { url, title, body };
  } catch (e) {
    return {
      error: e,
    };
  }
}

export async function htmlToMarkdown({ html }: { html: string }): Promise<any> {
  Logger.log("htmlToMarkdown:", JSON.stringify(html));
  let turndownOptions = Paster.config.turndownOptions;
  let content = toMarkdown(html, turndownOptions);
  return { content };
}
