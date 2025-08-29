# Markdown Paste

Smartly paste for Markdown.

**Support Mac/Windows/Linux!**.

![Markdown paste demo](./res/images/markdown_paste_demo_min.gif)

## Requirements

- `xclip` command be required (Linux)
- `powershell` command be required (Win32)
- `pbpaste` command be required (Mac)

## Features

- Paste smart

  Smartly paste in Markdown by pressing 'Ctrl+Alt+V' ('Cmd+Alt+V' on Mac) or `Markdown Paste` command.

  - If you paste an image, the extension will create an new file for the image and insert link code to Markdown (Disabled in SSH & Dev Container mode).
  - If you paste a text, it will test the text with customize regex, and replace matched content by regex.
  - If you paste a text contain HTML tag, it will try to convert the HTML content to Markdown.
  - If you paste a rich text, it will try to convert the rich text to Markdown.
    ![](./res/images/markdown-paste-rich-text-html-table.gif)

- Download file

  Use `Markdown Download` command (Linux or Windows:`Ctrl+Alt+D`, Mac:`Cmd+Alt+D`) to download file and insert link code into Markdown.
  ![](./res/images/markdown-paste-download-gif-demo.gif)

- Paste code

  Use `Markdown Paste Code` command (Linux or Window:`Ctrl+Alt+C`, Mac:`Cmd+Alt+C`) to paste code with auto-detecting language.

- Ruby tag

  Also, if you want to write article for learning Asia language like Chinese or Japanese, ruby tag(for example:<ruby>聪明<rp>(</rp><rt>Cōngmíng</rt><rp>)</rp></ruby>) may be useful. Now a ruby tag snippet are prepare for you, select some text and press 'Ctrl+Alt+T'.

  ```HTML
  <ruby>聪明<rp>(</rp><rt>pronunciation</rt><rp>)</rp></ruby>
  ```

  This extension will not get the pronunciation for you in this version. You have to replace 'pronunciation' by yourself.

- Insert latex math symbol and emoji

  You can insert latex math symbol and emoji to any text file, such as Julia source file.

  Press 'Ctrl+Alt+\\' or input "Insert latex math symbol" in vscode command panel, then input latex symbol name and choose symbol you want.

  ![](res/images/insert-math-symbol-2018-08-12-18-15-12.png)

- Embed base64 image

  While you paste image or download image, you can force the extension to insert embed base64 image to markdown by empty filename.

  ![](res/images/insert_embed_base64_image.gif)

- AI Parse Clipboard

  Use LLM AI to parse `text` or `HTML` clipboard content. You can also customize the AI clipboard parsing behavior to better suit different use cases by using the AI configurations

## Config

- Predefined variables

  - `${workspaceRoot}` or `${workspaceFolder}` - the path of the folder opened in VS Code
  - `${workspaceFolderBasename}` - the name of the folder opened in VS Code without any slashes (/)
  - `${fileWorkspaceFolder}` - the current opened file's workspace folder
  - `${file}` or `${filePath}` - the current opened file
  - `${relativeFileDirname}` - the current opened file's dirname relative to `$fileWorkspaceFolder`
  - `${fileBasename}` - the current opened file's base name
  - `${fileBasenameNoExtension}` - the current opened file's base name with no file extension
  - `${fileExtname}` - the current opened file's extension
  - `${fileDirname}` - the current opened file's directory name
  - `${datetime}` - the current date & time formatted by `"yyyyMMDDHHmmss"`, You can customize the format by format string. exp: `${datetime|yyyy-MM-DD_HH-mm-ss}`
  - `${selectedText}` - the current selected text. If selected text contain illegal characters `\/:*?""<>|\r\n` it will return "". You can also set the default text, exp: `${selectedText|default text}`, If selected text contain illegal characters or selected text is empty it will return the default text.
  - `${uuid}` - a random UUID v4

- `MarkdownPaste.path`

  The folder path that image will be saved. Support absolute path and relative path and predefined variables.

  Default value is `${fileDirname}`.

- `MarkdownPaste.nameBase`

  The string as the default image file name. Support predefined variables.

  Default value is `${datetime|yyyyMMDDHHmmss}`.

- `MarkdownPaste.namePrefix`

  The string prepend to the default image file name. Support predefined variables.

  Default value is `""`.

- `MarkdownPaste.nameSuffix`

  The string append to the default image file name. Support predefined variables.

  Default value is `""`.

- `MarkdownPaste.silence`

  Enable/disable showing confirm box while paste image. Set this config option to `true`, filename confirm box will not be shown while paste image.

  Default value is `false`.

- `MarkdownPaste.enableImgTag`

  Enable/disable using HTML img tag with width and height for pasting image. If this option be enabled, you can input width and height by using `<filepath>[?width,height]` in filename confirm input box. for example input `\abc\filename.png?200,100`, then `<img src='\abc\filename.png' width='200' height='100' />` will be inserted.

  Default value is `true`.

- `MarkdownPaste.encodePath`

  Encode path link to URL-encode format.

  - `encodeURI` Encode all characters to URL-encode format.
  - `encodeSpaceOnly` Encode `' '`(space) to `'%20'` only.
  - `none` Encode nothing.

  Default value is `encodeSpaceOnly`

- `MarkdownPaste.rules`

  If you want to define your own regex to parse and replace content for pasting text. You can fill the following JSON, and set it to this option.

  ```json
  [{
      // rule 1
      "regex": "(https?:\/\/.*)", // your javascript style regex
      "options": "ig",            // regex option
      "replace": "[]($1)"         // replace string
  },
  {
      // rule 2
      "regex": "(https?:\/\/.*)", // your javascript style regex
      "options": "ig",            // regex option
      "replace": "[]($1)"         // replace string
  },
  ...
  ]
  ```

  The extension will try to test text content by regex defined in this option, if matched it will replace content by using the TypeScript function string.replace().

  Default value is:

  ```json
  [
    {
      "regex": "^(?:https?://)?(?:(?:(?:www\\.?)?youtube\\.com(?:/(?:(?:watch\\?.*?v=([^&\\s]+).*)|))?))",
      "options": "g",
      "replace": "[![](https://img.youtube.com/vi/$1/0.jpg)](https://www.youtube.com/watch?v=$1)"
    },
    {
      "regex": "^(https?://.*)",
      "options": "ig",
      "replace": "[]($1)"
    }
  ]
  ```

  **NOTE** While pasting image, this option also apply to render image path link.

- `MarkdownPaste.applyAllRules`

  If true, it will apply all rules to the same text orderly, instead only the first applicable one.

  Default value is `True`.

- `MarkdownPaste.enableHtmlConverter`

  Enable/disable converting html to markdown.

  Default value is `True`.

- `MarkdownPaste.enableRulesForHtml`

  Enable/disable using rules after converting html to markdown.

  Default value is `True`.

- `MarkdownPaste.turndownOptions`

  Use turndown options when cover html to markdown, please see [turndown options](https://github.com/mixmark-io/turndown#options) for detail.

  Default value is `setext`

- `MarkdownPaste.lang_rules`

  As `MarkdownPaste.rules`, you can define rules for other language (for example: asciidoc).

  ```json
  [
    [
      {
        "asciidoc": [
          {
            "regex": "^(?:https?://)?(?:(?:(?:www\\.?)?youtube\\.com(?:/(?:(?:watch\\?.*?v=([^&\\s]+).*)|))?))",
            "options": "g",
            "replace": "image::https://img.youtube.com/vi/$1/0.jpg[link=\"https://www.youtube.com/watch?v=$1\"]"
          },
          {
            "regex": "^(https?://.*)",
            "options": "ig",
            "replace": "image::$1[linktext,300]"
          },
          {
            "regex": "(.*/media/)(.*)",
            "options": "",
            "replace": "image::$2[linktext,300]"
          }
        ]
      },
      {
        "markdownx": [
          {
            "regex": "^(?:https?://)?(?:(?:(?:www\\.?)?youtube\\.com(?:/(?:(?:watch\\?.*?v=([^&\\s]+).*)|))?))",
            "options": "g",
            "replace": "[![](https://img.youtube.com/vi/$1/0.jpg)](https://www.youtube.com/watch?v=$1)"
          },
          {
            "regex": "^(https?://.*)",
            "options": "ig",
            "replace": "[]($1)"
          }
        ]
      }
    ]
  ]
  ```

  **NOTE** If any language rule been matched, it will not apply `MarkdownPaste.rules` anymore.

- `MarkdownPaste.autoSelectClipboardType`

  Auto select clipboard type while multiple clipboard types are available. default is: `html&text`

- `MarkdownPaste.autoSelectClipboardTypePriority`

  Auto select clipboard type priority. default is:

  ```json
  ["image", "html", "text"]
  ```

- `MarkdownPaste.enableAI`

  Enable AI clipboard parsing feature. default is `false`.

- `MarkdownPaste.openaiConnectOption`

  Set OpenAI (compatible) connection options. default is:

  ```json
  "MarkdownPaste.openaiConnectOption": {
      "apiKey": "",
      "baseURL": "https://api.groq.com/openai/v1",
      "maxRetries": 2
  }
  ```

  The extension use Groq LLM server by default. You can got an API key from [Groq.com](https://groq.com/).  
  The extension use [OpenAi Node](https://github.com/openai/openai-node) to connect LLM server. So you can also use another LLM server by setting `MarkdownPaste.openaiConnectOption.baseURL`, e.g. `MarkdownPaste.openaiConnectOption.baseURL = "https://api.openai.com/v1"`, the more detail about openai connection options, please see: https://github.com/openai/openai-node

- `MarkdownPaste.openaiCompletionTemplate`

  Set OpenAI completion template. default is:

  ```json
  [
    {
      "model": "llama-3.1-70b-versatile",
      "messages": [
        {
          "role": "system",
          "content": ["You are a helpful assistant."]
        },
        {
          "role": "user",
          "content": [
            "Translate the following text into English and output in markdown format:",
            "{{clipboard_text}}"
          ]
        }
      ],
      "max_tokens": 4096
    }
  ]
  ```

  Note: The extension will replace `{{clipboard_text}}` with your clipboard content.

- `MarkdownPaste.openaiCompletionTemplateFile`

  Set OpenAI completion template file. default is: `${fileWorkspaceFolder}/.openaiCompletionTemplate.json`

  If you want to write more complicated AI completion template, you can use this option.

- **`MarkdownPaste.imageRules`**  
  **(New Feature)** Define custom rules to modify the target image path and Markdown link pattern based on the current Markdown file's path. Each rule is an object with the following properties:

  - `match`: A regex pattern (as a string) to test against the current Markdown file’s full path.
  - `targetPath`: A string pattern (supports predefined variables) that specifies where the image should be saved.
  - `linkPattern`: A string pattern (supports predefined variables) that specifies how the Markdown link for the image should be formatted. You can use `${altText}` as selected text,`${imageFilePath}` as image saved path in the setting.
  - `options` (optional): Regex options (e.g., `"i"`) for the matching pattern.

  **Example:**

  ```json
  "MarkdownPaste.imageRules": [
    {
      "match": "courses.*cysec",
      "targetPath": "${workspaceFolder}/labs/public/images/cysec/${fileBasenameNoExtension}_${datetime|yyyy-MM-DD_HH-mm-ss}",
      "linkPattern": "![${altText}](/images/cysec/${fileBasenameNoExtension}_${datetime|yyyy-MM-DD_HH-mm-ss}.png)"
    },
    {
      "match": "courses.*wired",
      "targetPath": "${workspaceFolder}/labs/public/images/wired/${fileBasenameNoExtension}_${datetime|yyyy-MM-DD_HH-mm-ss}",
      "linkPattern": "<img src='/images/wired/${fileBasenameNoExtension}_${datetime|yyyy-MM-DD_HH-mm-ss}.png' alt='${altText}'/>"
    }
  ]
  ```

## Issues and Suggestions

1. Please submit bugs via the following link:

   https://github.com/telesoho/vscode-markdown-paste-image/issues

2. Please post suggestions via the following link:

   https://github.com/telesoho/vscode-markdown-paste-image/discussions

## Contributing

See [the contribution guidelines](./CONTRIBUTING.md) for ideas and guidance on how to improve the extension. Thank you!

## License

The extension and source are licensed under the [MIT license](LICENSE.txt).
