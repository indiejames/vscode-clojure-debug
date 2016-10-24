import {HoverProvider, TextDocument, Position, CancellationToken, Hover} from 'vscode';
import {EditorUtils} from './editorUtils';
import {ReplConnection} from './replConnection';

export class ClojureHoverProvider implements HoverProvider {
	private connection: ReplConnection;

  constructor(conn: ReplConnection) {
    this.connection = conn;
  }

	provideHover(document: TextDocument, position: Position, token: CancellationToken): Thenable<Hover> {
		let self = this;
    let ns = EditorUtils.findNSDeclaration(document.getText());
    let wordRange = document.getWordRangeAtPosition(position);
    let variable = document.getText(wordRange);
		// ignore keywords
		if (variable.substr(0,1) == ":") {
			return Promise.reject("");
		}
		try {
			return new Promise<Hover>((resolve, reject) => {
				if (this.connection.isConnected()) {
					this.connection.doc(ns, variable, (err: any, msg: any) => {
						if (err) {
							reject(err);
						} else if (msg.constructor === Array && msg.length > 0) {
							var docstring = msg[0]["doc"];
							if (docstring == undefined) {
								resolve(undefined);
							} else if (docstring.constructor === Array && docstring.length > 0) {
								// let signature = docstring[1];
								// docstring[1] = {langauge: "Clojure", value: signature};
								// docstring[2] = {language: "Clojure", value: "```\n" + docstring[2].replace(/\\n/g,"\n") + "\n```"};
								let hover = new Hover(docstring);
								resolve(hover);
							} else {
								resolve(undefined);
							}

						} else {
							resolve(undefined);
						}
					});
				} else {
					resolve(undefined);
				}
			});
		} catch (Error){
			return Promise.reject("");
		}
	}
}