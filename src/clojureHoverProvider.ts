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

				this.connection.doc(ns, variable, (err: any, msg: any) => {
					if (err) {
						reject(err);
					} else if (msg.constructor === Array && msg.length > 0) {
						var docstring = msg[0]["doc"];
						if (docstring == undefined) {
							resolve(undefined);
						} else {
							docstring = docstring.replace(/\\n/g,"\n");
							let hover = new Hover(docstring);
							resolve(hover);
						}

					} else {
						resolve(undefined);
					}
				});
			});
		} catch (Error){
			return Promise.reject("");
		}
	}
}