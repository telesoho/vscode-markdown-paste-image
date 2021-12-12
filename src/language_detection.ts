
import { ModelOperations, ModelResult} from "@vscode/vscode-languagedetection";

class LanguageDetection {
	private static readonly expectedRelativeConfidence = 0.001;

	private _loadFailed = false;
	private _modelOperations: ModelOperations | undefined;

	private async getModelOperations(): Promise<ModelOperations> {
		if (this._modelOperations) {
			return this._modelOperations;
		}

		this._modelOperations = new ModelOperations();
        return this._modelOperations;
	}

	async detectLanguage(content: string ): Promise<string | undefined> {

		if (content) {
			for await (const language of this.detectLanguagesImpl(content)) {
				return language;
			}
		}
		return '';
	}

	async detectLanguages(content: string): Promise<string[]> {
		const languages: string[] = [];
		if (content) {
			for await (const language of this.detectLanguagesImpl(content)) {
				languages.push(language);
			}
		}
		return languages;
	}

	private async * detectLanguagesImpl(content: string) {
		if (this._loadFailed) {
			return;
		}

		let modelOperations: ModelOperations | undefined;
		try {
			modelOperations = await this.getModelOperations();
		} catch (e) {
			this._loadFailed = true;
			return;
		}

		const modelResults = await modelOperations.runModel(content);
		if (!modelResults) {
			return;
		}

		if (modelResults[0].confidence < LanguageDetection.expectedRelativeConfidence) {
			return;
		}

		const possibleLanguages: ModelResult[] = [modelResults[0]];

		for (let current of modelResults) {

			if (current === modelResults[0]) {
				continue;
			}

			const currentHighest = possibleLanguages[possibleLanguages.length - 1];

			if (currentHighest.confidence - current.confidence >= LanguageDetection.expectedRelativeConfidence) {
				while (possibleLanguages.length) {
					// TODO: see if there's a better way to do this.
					const vscodeLanguageId = possibleLanguages.shift()!.languageId;
					if (vscodeLanguageId) {
						yield vscodeLanguageId;
					}
				}
				if (current.confidence > LanguageDetection.expectedRelativeConfidence) {
					possibleLanguages.push(current);
					continue;
				}
				return;
			} else {
				if (current.confidence > LanguageDetection.expectedRelativeConfidence) {
					possibleLanguages.push(current);
					continue;
				}
				return;
			}
		}
	}
}

export { LanguageDetection};
