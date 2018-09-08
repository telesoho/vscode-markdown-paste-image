'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import {mkdir} from 'shelljs';
import * as clipboard from 'clipboardy'
import {spawn} from 'child_process';
import * as moment from 'moment';
import {latexSymbols} from './latex';

class LatexSymbol {
    latexItems: vscode.QuickPickItem[] = [];

    public getItems() {
        return this.latexItems;
    }

    public load(latexSymbols) {
        this.latexItems = [];
        for (let name in latexSymbols) {
            this.latexItems.push({
                description: latexSymbols[name],
                label: name,
            });
        }
    }

    public insertToEditor(item: vscode.QuickPickItem) {
        if (!item) { return; }
        let editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
    
        editor.edit( (editBuilder) => {
            editBuilder.delete(editor.selection);
        }).then( () => {
            editor.edit( (editBuilder) => {
                editBuilder.insert(editor.selection.start, item.description);
            });
        });
    }
}


export function activate(context: vscode.ExtensionContext) {
    console.log('"vscode-markdown-paste" is now active!');
    let LatexMathSymbol = new LatexSymbol();
    LatexMathSymbol.load(latexSymbols);
    vscode.commands.registerCommand('telesoho.insertMathSymbol', () => {
        vscode.window.showQuickPick(LatexMathSymbol.getItems(), {
            ignoreFocusOut: true,
        }).then(LatexMathSymbol.insertToEditor);
    });

    context.subscriptions.push(vscode.commands.registerCommand(
        'telesoho.MarkdownPaste', () => {
            console.log('Paster.pasteText');
            Paster.pasteText();
        }));
    context.subscriptions.push(vscode.commands.registerCommand(
        'telesoho.MarkdownRuby', () => {
            Paster.Ruby();
        }));
}

export function deactivate() {
    console.log('"vscode-markdown-paste" is now deactivate!');
}


class Paster {

    /**
     * Paste text
     */
    public static pasteText() {
        var ret = this.getClipboardContentType((ctx_type) => {
            switch(ctx_type) {
                case "text/html":
                    this.pasteTextHtml((html)=>{
                        var markdown = this.toMarkdown(html);
                        Paster.writeToEditor(markdown);
                    });
                break;
                case "text/plain":
                    var content = clipboard.readSync();
                    if (content) {
                        let newContent = Paster.parse(content);
                        Paster.writeToEditor(newContent);
                    }
                break;
                case "image/png":
                    Paster.pasteImage();
                break;
            }
        });

        // If cannot get content type then try to read clipboard once
        if(false == ret) {
            var content = clipboard.readSync();
            if (content) {
                let newContent = Paster.parse(content);
                Paster.writeToEditor(newContent);
            } else {
                Paster.pasteImage();
            }
        }
    }

    /**
     * Ruby tag
     */
    public static Ruby() {
        let editor = vscode.window.activeTextEditor;
        if (!editor) return;
        let rubyTag = new vscode.SnippetString("<ruby>${TM_SELECTED_TEXT}<rp>(</rp><rt>${1:pronunciation}</rt><rp>)</rp></ruby>");
        editor.insertSnippet(rubyTag);
    }

    private static isHTML(content) {
        return /<[a-z][\s\S]*>/i.test(content);
    }

    private static writeToEditor(content): Thenable < boolean > {
        let startLine = vscode.window.activeTextEditor.selection.start.line;
        var selection = vscode.window.activeTextEditor.selection
        let position = new vscode.Position(startLine, selection.start.character);
        return vscode.window.activeTextEditor.edit((editBuilder) => {
            editBuilder.insert(position, content);
        });
    }

    protected static saveImage(inputVal) {
        if (!inputVal) return;

        let editor = vscode.window.activeTextEditor;
        if (!editor) return;

        let fileUri = editor.document.uri;
        if (!fileUri) return;

        let filePath = fileUri.fsPath;

        // User may be input a path with backward slashes (\), so need to replace all '\' to '/'.
        inputVal = inputVal.replace(
            "${workspaceRoot}", vscode.workspace.rootPath).replace(/\\/g, '/');

        if (inputVal && (inputVal.length !== inputVal.trim().length)) {
            vscode.window.showErrorMessage('The specified path is invalid: "' + inputVal + '"');
            return;
        }

        this.createImageDirWithImagePath(inputVal).then(imgPath => {
            // save image and insert to current edit file
            this.saveClipboardImageToFileAndGetPath(imgPath, imagePath => {
                if (!imagePath) return;
                if (imagePath === 'no image') {
                    vscode.window.showInformationMessage('There is not a image in clipboard.');
                    return;
                }

                imagePath = this.renderFilePath(editor.document.languageId, filePath, imagePath);

                editor.edit(edit => {
                    let current = editor.selection;

                    if (current.isEmpty) {
                        edit.insert(current.start, imagePath);
                    } else {
                        edit.replace(current, imagePath);
                    }
                });
            });
        }).catch(err => {
            vscode.window.showErrorMessage('Make folder failed:' + inputVal);
            return;
        });
    }

    private static parse(content) {
        let rules = vscode.workspace.getConfiguration('MarkdownPaste').rules;

        for (var i = 0; i < rules.length; i++) {
            let rule = rules[i];
            var re = new RegExp(rule.regex, rule.options);
            var reps = rule.replace;
            if (re.test(content)) {
                var newstr = content.replace(re, reps);
                return newstr;
            }
        }

        if (Paster.isHTML(content)) {
            return this.toMarkdown(content);
        }

        return content;
    }

    private static pasteTextHtml(callback:(data) => void) {
        var script = {
            'win32': "win32_get_clipboard_text_html",
            'linux': "linux_get_clipboard_text_html.sh"
        };
        var ret = this.runScript(script, [], (data) => {
            callback(data.toString().trim());
        });
        return ret;
    }

    private static toMarkdown(content) {
        // http://pandoc.org/README.html#pandocs-markdown
        var pandoc = [
            {
                filter: 'h1',
                replacement: function (content, node) {
                    var underline = Array(content.length + 1).join('=');
                    return '\n\n' + content + '\n' + underline + '\n\n';
                }
            },

            {
                filter: 'h2',
                replacement: function (content, node) {
                    var underline = Array(content.length + 1).join('-');
                    return '\n\n' + content + '\n' + underline + '\n\n';
                }
            },

            {
                filter: 'sup',
                replacement: function (content) {
                    return '^' + content + '^';
                }
            },

            {
                filter: 'sub',
                replacement: function (content) {
                    return '~' + content + '~';
                }
            },

            {
                filter: 'br',
                replacement: function () {
                    return '\\\n';
                }
            },

            {
                filter: 'hr',
                replacement: function () {
                    return '\n\n* * * * *\n\n';
                }
            },

            {
                filter: ['em', 'i', 'cite', 'var'],
                replacement: function (content) {
                    return '*' + content + '*';
                }
            },

            {
                filter: function (node) {
                    var hasSiblings = node.previousSibling || node.nextSibling;
                    var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;
                    var isCodeElem = node.nodeName === 'CODE' ||
                        node.nodeName === 'KBD' ||
                        node.nodeName === 'SAMP' ||
                        node.nodeName === 'TT';

                    return isCodeElem && !isCodeBlock;
                },
                replacement: function (content) {
                    return '`' + content + '`';
                }
            },

            {
                filter: function (node) {
                    return node.nodeName === 'A' && node.getAttribute('href');
                },
                replacement: function (content, node) {
                    var url = node.getAttribute('href');
                    var titlePart = node.title ? ' "' + node.title + '"' : '';
                    if (content === url) {
                        return '<' + url + '>';
                    } else if (url === ('mailto:' + content)) {
                        return '<' + content + '>';
                    } else {
                        return '[' + content + '](' + url + titlePart + ')';
                    }
                }
            },

            {
                filter: 'li',
                replacement: function (content, node) {
                    content = content.replace(/^\s+/, '').replace(/\n/gm, '\n    ');
                    var prefix = '-   ';
                    var parent = node.parentNode;

                    if (/ol/i.test(parent.nodeName)) {
                        var index = Array.prototype.indexOf.call(parent.children, node) + 1;
                        prefix = index + '. ';
                        while (prefix.length < 4) {
                            prefix += ' ';
                        }
                    }

                    return prefix + content;
                }
            },
            {
                filter: ['font', 'span'],
                replacement: function (content) {
                    return content;
                }
            }
        ];

        // http://pandoc.org/README.html#smart-punctuation
        var escape = function (str) {
            return str.replace(/[\u2018\u2019\u00b4]/g, "'")
                .replace(/[\u201c\u201d\u2033]/g, '"')
                .replace(/[\u2212\u2022\u00b7\u25aa]/g, '-')
                .replace(/[\u2013\u2015]/g, '--')
                .replace(/\u2014/g, '---')
                .replace(/\u2026/g, '...')
                .replace(/[ ]+\n/g, '\n')
                .replace(/\s*\\\n/g, '\\\n')
                .replace(/\s*\\\n\s*\\\n/g, '\n\n')
                .replace(/\s*\\\n\n/g, '\n\n')
                .replace(/\n-\n/g, '\n')
                .replace(/\n\n\s*\\\n/g, '\n\n')
                .replace(/\n\n\n*/g, '\n\n')
                .replace(/[ ]+$/gm, '')
                .replace(/^\s+|[\s\\]+$/g, '');
        };

        var toMarkdown = require("to-markdown");
        return escape(toMarkdown(content, { converters: pandoc, gfm: true }));
    }

    private static pasteImage() {
        // get current edit file path
        let editor = vscode.window.activeTextEditor;
        if (!editor) return;

        let fileUri = editor.document.uri;
        if (!fileUri) return;
        if (fileUri.scheme === 'untitled') {
            vscode.window.showInformationMessage('Before paste image, you need to save current edit file first.');
            return;
        }

        // get selection as image file name, need check
        var selection = editor.selection;
        var selectText = editor.document.getText(selection);

        if (selectText && !/^[^\\/:\*\?""<>|]{1,120}$/.test(selectText)) {
            vscode.window.showInformationMessage('Your selection is not a valid file name!');
            return;
        }

        // get image destination path
        let folderPathFromConfig = vscode.workspace.getConfiguration('pasteImage').path;

        folderPathFromConfig = folderPathFromConfig.replace("${workspaceRoot}", vscode.workspace.rootPath);

        if (folderPathFromConfig && (folderPathFromConfig.length !== folderPathFromConfig.trim().length)) {
            vscode.window.showErrorMessage('The specified path is invalid: "' + folderPathFromConfig + '"');
            return;
        }

        let imagePath = this.getImagePath(
            fileUri.fsPath, selectText, folderPathFromConfig);
        let fileNameLength = selectText ? selectText.length : 19; // yyyy-mm-dd-hh-mm-ss

        let silence = vscode.workspace.getConfiguration('pasteImage').silence;
        if (silence) {
            Paster.saveImage(imagePath);
        } else {
            let options: vscode.InputBoxOptions = {
                prompt: "You can change the filename, exist file will be overwrite!.",
                value: imagePath,
                placeHolder: "(e.g:../test/myimage.png)",
                valueSelection: [imagePath.length - 4 - fileNameLength, imagePath.length - 4],
            }
            vscode.window.showInputBox(options).then(inputVal => {
                Paster.saveImage(inputVal);
            });
        }
    }

    private static getImagePath(filePath: string, selectText: string, folderPathFromConfig: string): string {
        // image file name
        let imageFileName = "";
        if (!selectText) {
            imageFileName = moment().format("Y-MM-DD-HH-mm-ss") + ".png";
        } else {
            imageFileName = selectText + ".png";
        }

        // image output path
        let folderPath = path.dirname(filePath);
        let imagePath = "";

        // generate image path
        if (path.isAbsolute(folderPathFromConfig)) {
            // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
            imagePath = path.join(folderPathFromConfig, imageFileName).replace(/\\/g, '/');
        } else {
            // important: replace must be done at the end, path.join() will build a path with backward slashes (\)
            imagePath = path.join(folderPath, folderPathFromConfig, imageFileName).replace(/\\/g, '/');
        }

        return imagePath;
    }

    /**
     * create directory for image when directory does not exist
     */
    private static createImageDirWithImagePath(imagePath: string) {
        return new Promise((resolve, reject) => {
            let imageDir = path.dirname(imagePath).replace(/\\/g, '/');

            try {
                mkdir('-p', imageDir);
            } catch (error) {
                console.log(error);
                reject(error);
                return;
            }
            resolve(imagePath);
        });
    }

    private static getClipboardContentType(cb: (targets) => void) {
        var script = {
            'linux': "linux_clipboard_content_type.sh",
            'wind32': "win32_clipboard_content_type.ps1"
        };

        let ret = this.runScript(script, [], (data) => {
            let result = data.toString().trim();
            if (result == "no xclip") {
                vscode.window.showInformationMessage('You need to install xclip command first.');
                return;
            }
            let result_array = result.split("\n");
            let content_type = "unknow";
            if(result_array) {
                for(var i = 0; i < result_array.length; i++) {
                    var element = result_array[i];
                    if(element == "text/html") {
                        content_type = element;
                        break;
                     } else if (element == "text/plain") {
                         content_type = element;
                         continue;
                     } else if(element == "image/png" ) {
                         content_type = element;
                         break;
                     }
                }
            }
            cb(content_type);
        });
        return ret;
    }

    /**
     * 
     * @param script 
     * @param parameters 
     * @param callback 
     */
    private static runScript(script, parameters = [], callback = (data) => {} ) {
        let platform = process.platform;
        if(typeof script[platform] === "undefined") {
            console.log(`Cannot found script for ${platform}`);
            return false;
        }
        const scriptPath = path.join(__dirname, '../res/' + script[platform]);
        let shell = "";
        let command = [];

        if (platform === 'win32') {
            // Windows
            command = [
                '-noprofile',
                '-noninteractive',
                '-nologo',
                '-sta',
                '-executionpolicy', 'unrestricted',
                '-windowstyle', 'hidden',
                '-file', scriptPath].concat(parameters)
            shell = 'powershell';
        } else if (platform === 'darwin') {
            // Mac
            shell = 'osascript';
            command = [scriptPath].concat(parameters);
        } else {
            // Linux
            shell = 'sh';
            command = [scriptPath].concat(parameters);
        }

        const runer = spawn(shell, command);
        runer.on('exit', function (code, signal) {
            // console.log('exit', code, signal);
        });
        runer.stdout.on('data', function (data: Buffer) {
            if(callback) {
                callback(data);
            }
        });
        return true;
    }

    /**
     * use applescript to save image from clipboard and get file path
     */
    private static saveClipboardImageToFileAndGetPath(imagePath, cb: (imagePath: string) => void) {
        if (!imagePath) return;

        const script = {
            'win32':"win32_save_clipboard_png.ps1",
            "darwin": "mac.applescript",
            "linux": "linux_save_clipboard_png.sh"
        };

        let ret = this.runScript(script,[imagePath], (data) => {
            cb(data.toString().trim());
        });

        // let platform = process.platform;
        // if (platform === 'win32') {
        //     // Windows
        //     const scriptPath = path.join(__dirname, '../res/pc.ps1');
        //     const powershell = spawn('powershell', [
        //         '-noprofile',
        //         '-noninteractive',
        //         '-nologo',
        //         '-sta',
        //         '-executionpolicy', 'unrestricted',
        //         '-windowstyle', 'hidden',
        //         '-file', scriptPath,
        //         imagePath
        //     ]);
        //     powershell.on('exit', function (code, signal) {
        //         // console.log('exit', code, signal);
        //     });
        //     powershell.stdout.on('data', function (data: Buffer) {
        //         cb(data.toString().trim());
        //     });
        // } else if (platform === 'darwin') {
        //     // Mac
        //     let scriptPath = path.join(__dirname, '../res/mac.applescript');

        //     let ascript = spawn('osascript', [scriptPath, imagePath]);
        //     ascript.on('exit', function (code, signal) {
        //         // console.log('exit',code,signal);
        //     });

        //     ascript.stdout.on('data', function (data: Buffer) {
        //         cb(data.toString().trim());
        //     });
        // } else {
        //     // Linux 
        //     let scriptPath = path.join(__dirname, '../res/linux_save_clipboard_png.sh');

        //     console.log('sh', [scriptPath, imagePath]);
        //     let ascript = spawn('sh', [scriptPath, imagePath]);
        //     ascript.on('exit', function (code, signal) {
        //         // console.log('exit',code,signal);
        //     });

        //     ascript.stdout.on('data', function (data: Buffer) {
        //         let result = data.toString().trim();
        //         if (result == "no xclip") {
        //             vscode.window.showInformationMessage('You need to install xclip command first.');
        //             return;
        //         }
        //         cb(result);
        //     });
        // }
        return ret;
    }

    /**
     * render the image file path dependen on file type
     * e.g. in markdown image file path will render to ![](path)
     */
    public static renderFilePath(languageId: string, docPath: string, imageFilePath: string): string {
        // relative will be add backslash characters so need to replace '\' to '/' here.
        imageFilePath = path.relative(path.dirname(docPath), imageFilePath).replace(/\\/g, '/');

        if (languageId === 'markdown') {
            return `![](${imageFilePath})`;
        } else {
            return imageFilePath;
        }
    }
}