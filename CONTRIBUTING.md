<h1>Contributing</h1>

# Raising Issues

If you've found an issue or have a suggestion, please do [open an issue](https://github.com/telesoho/vscode-markdown-paste-image/issues/new). For bugs, it is beneficial to attach a log file recorded while reproducing the issue. You can copy log from VS Code `Markdown Paste` Output Channel (View → Output).

# Contributing Code

For general details on developing VS Code extensions see the [VS Code API docs](https://code.visualstudio.com/api).

## Project Structure

There's a lot of configuration for how Code interacts in `package.json` though the main entry point is the `activate` method in `src/extension.ts`. Functionality is split into classes that provide small pieces of functionality via the Code APIs ([which are documented here](https://code.visualstudio.com/docs/extensionAPI/vscode-api)).

Source code is split into several top level folders:

### src

`src` The folder contains VS Code extension source code.

### test

`test/suite` Code for automated test suites.

## Cloning and Running

Running from source is relatively straight forward. You should:

1. Clone the repository (or your own fork)

   ```sh
    git clone https://github.com/telesoho/vscode-markdown-paste-image.git --recursive
   ```

2. Run `npm install` to install dependencies
3. Open the repository root folder in Visual Studio Code
4. Ensure `Launch Extension` is selected in the Debug sidebar
5. Press `F5`

## Automated Tests

Automated tests live in the `test/suite` folder, you can select `Extension Tests` form the Debug sidebar to run them. You can also use `npm test` to run the whole suite in one go (without the debugging, but you need to close current opening VS Code).

## Release Procedure

### Testing

- Before testing/deploying, ensure you have run `npm install` recently so that your local dependencies match those listed in the dependencies list (in case they have been upgraded)
- Ensure all local changes are committed and your local folder is free of artifacts/log files/etc.
- Ensure all automated tests pass

### Deploying

- Run `vsce ls` to preview files that will be included in the release (ensure there are no artifacts/log files/etc. hanging around in your directory that haven't been excluded by `.vscodeignore`)
- Set the version number correctly in `packages.json`
- Commit and push to GitHub (pushing before creating the GH release is important for the tag to be against the correct version)
- Create a new Release on GitHub with the tag "v{x.y.z}" where `{x.y.z}` is the correct version number, then GitHub actions will auto publish the extension.
