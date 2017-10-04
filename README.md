# Markdown Paste

Automaticaly create file for pasting image content. Parse text content and generator content on your rules for pasting text.

**Support Mac/Windows/Linux!**.

![markdown paste demo](./res/markdown_paste_demo_min.gif)

## Paste Image

1. Capture screen to clipboard
1. Open the command palette: `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac)
1. Type: "Markdown Paste" or you can use default keyboard binding: `Ctrl+Alt+V` (`Cmd+Alt+V` on Mac).
1. Image will be saved in the folder that you specified in configuration.

## Paste Text

1. Copy a youtube video url.
1. Open the command palette: `Ctrl+Shift+P` (`Cmd+Shift+P` on Mac)
1. Type: "Markdown Paste" or you can use default keyboard binding: `Ctrl+Alt+V` (`Cmd+Alt+V` on Mac).
1. The youtube embedded code will be generated for the video.

## Config

- `pasteImage.path`

    The folder path that image will be saved. Support absolute path and relative path and variable ${workspaceRoot}.

    Default value is `./`, mean save image in the folder contains current file.

- `pasteImage.silence`

    enable/disable showing confirm box while paste image. Set this config option to `true`, filename confirm box will not be shown while paste image.

    Default value is `false`

- `MarkdownPaste.rules`

    This option is an array of regex replace JSON rule. If you want to define your own rule to parse and replace content for pasting text. You can fill the following JSON, and add it to this option.
    ```JSON
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
    }
    ]
    ```

    The extension will test pasting text by your regex, if matched then do regex replace by using the TypeScript function string.replace().

    Default value is

    ```JSON
    [{
        "regex": "(?:https?:\/\/)?(?:(?:(?:www\\.?)?youtube\\.com(?:\/(?:(?:watch\\?.*?v=([^&\\s]+).*)|))?))",
        "options": "g",
        "replace": "[![](https://img.youtube.com/vi/$1/0.jpg)](https://www.youtube.com/watch?v=$1)"
    },
    {
        "regex": "(https?:\/\/.*)",
        "options": "ig",
        "replace": "[]($1)"
    }]

    ```

## Format

### File name format

If you selected some text in editor, then extension will use it as the image file name.
If not the image will be saved in this format: "Y-MM-DD-HH-mm-ss.png".

### File link format

When you editing a markdown, it will pasted as markdown image link format `![](imagePath)`, the imagePath will be resolve to relative path of current markdown file. In other file, it just paste the image's path.

## FAQ

1. Extension not working on windows os.

   https://github.com/telesoho/vscode-markdown-paste-image/issues/6

## Contact

If you have some any question or advice, Welcome to [issue](https://github.com/telesoho/vscode-markdown-paste-image/issues)

## License

The extension and source are licensed under the [MIT license](LICENSE.txt).
