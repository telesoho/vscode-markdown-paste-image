# Change Log

## 0.18.4 (February 19, 2022)

- Fix: parse lang_rules output not correct

## 0.18.3 (February 12, 2022)

- Fix: #72 Windows: Images are always saved to C:

## 0.18.2 (February 12, 2022)

- Add nameBase option and predefined variable ${datetime}.

## 0.18.1 (February 12, 2022)

- Fix: Markdown Download command render incorrect path for download image.

## 0.18.0 (February 12, 2022)

- Feature: Allow pasting of images in documents of other languages than markdown (like asciidoc) #56

## 0.17.2 (February 11, 2022)

- Fix #70 markdown img syntax isn't used in mdx files

## 0.17.1 (February 11, 2022)

- Add the option to use ${fileWorkspaceFolder} #71

## 0.16.1 (January 4, 2022)

- Fix #65: Newlines in path for WSL causing image saving failures

## 0.16.0 (January 4, 2022)

- Feature: Support Multi-root Workspaces Folder Settings #64

## 0.15.3 (Dec 29, 2021)

- Fix #60: Can't Paste Images to Paths Containing Whitespaces

## 0.15.1 (Dec 24, 2021)

- Prioritize Image pastes over HTML pastes over text pastes

## 0.15.0 (Dec 24, 2021)

- Feature: Support WSL

## 0.14.0 (Dec 12, 2021)

- Feature: Support for pasting code with auto detecting language #50

## 0.13.8 (August 5, 2021)

- Fix #46: Variable "${workspaceRoot}" looks resolved incorrectly

## 0.13.7 (August 2, 2021)

- Fix #45: command 'telesoho.MarkdownPaste' not found

## 0.13.4 (August 2, 2021)

- Fix #42: files being saved to incorrect location
- Fix #38: MarkdownPaste shotcut only work on markdown mode

## 0.13.3 (July 2, 2021)

- Feature: Embed base64 image supported.
- Add MarkdownPaste.encodePath configuration.

## 0.12.3 (Sep 19, 2019)

- Fix some grammar mistakes.

## 0.12.2 (Sep 1, 2019)

- Fix #25: encode url in markdown

## 0.12.0 (Feb 8, 2019)

- Feature: Paste local file path that under workspace folder, will add relative path link into markdown.

## 0.11.1 (Dec 21, 2018)

- Fixed: Paste text doesn't work on some Linux.

## 0.11.0 (Dec 3, 2018)

- Change setting name from `pasteImage` to `MarkdownPaste`
- Feature: Download url file

## 0.10.1 (Nov 12, 2018)

- Feature: emoji supported

## 0.10.0 (Nov 5, 2018)

- Feature #20: Paste image in HTML format.

## 0.9.5 (Oct 25, 2018)

- Fixed: Cannot get all content in clipboard.
- Optimize convert html table (colspan supported) to markdown.

## 0.9.2 (Oct 13, 2018)

- Support more predefined variables

## 0.9.1 (September 12, 2018)

- Remove devDependencies clipboardy for Window and Linux
- Optimize convert html to markdown.

## 0.9.0 (September 8, 2018)

- Feature: Convert rich text to markdown
- Fix #18: Paste path add `./` and File name verification support for Chinese

## 0.8.0 (August 12, 2018)

- Feature: Insert latex math symbol into current editor.

## 0.7.5 (April 23, 2018)

- Fixed #13: downgrade clipboardy to v1.1.4.

## 0.7.4 (April 20, 2018)

- Update all dependencies.
- Add requirment setion to README

## 0.7.3 (November 10, 2017)

- Fix #10: Chinese encoding problem.

## 0.7.1 (October 14, 2017)

- Feature: Convert HTML to Markdown for pasing HTML content.
- Feature: Add a snippets for adding ruby tag.

## 0.6.2 (October 04, 2017)

- Feature: Parse and replace content for pasting text.

## 0.5.0 (September 15, 2017)

- Feature #8 : Autoselect filename for easier renaming.(thank @huhk-sysu)

## 0.4.9 (August 28, 2017)

- Fix #7 :Fix encoding problem in non-english language in Windows os.

## 0.4.7 (May 21, 2017)

- Fix #5 : Enable upper case as file name.
- Add pasteImage.silence configure option.

## 0.4.3 (May 21, 2017)

- Fix #4 : Cannot create first level sub folder of root folder on windows.

## 0.4.1 (May 20, 2017)

- Fix #2 : Use forward slashes "/" in the image url

## 0.4.0 (May 19, 2017)

- Feature: Support rename image after paste.

## 0.3.0 (December 31, 2016)

- Feature: Support config the path(absolute or relative) to save image.

## 0.2.0 (November 13, 2016)

- Feature: Add linux support by xclip
- Feature: Support use the selected text as the image name

## 0.1.0 (November 12, 2016)

- Feature: Add windows support by powershell

## 0.0.1

- Finish first publish. Only support macos.
