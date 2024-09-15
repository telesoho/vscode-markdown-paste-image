import axios from "axios";

export async function fetchWeb({ url }: { url: string }): Promise<any> {
  let content = "";
  try {
    const response = await axios.get(url);
    content = response.data;
    return { content };
  } catch (e) {
    return {
      error: e,
    };
  }
}
