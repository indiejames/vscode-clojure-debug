/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {window, workspace, DocumentFormattingEditProvider, FormattingOptions, TextEdit, Range, Location, TextDocument, Position, Uri, CancellationToken} from 'vscode';
import nrepl_client = require('jg-nrepl-client');
import edn = require('jsedn');
import {EditorUtils} from './editorUtils';
import {CompletionUtils} from './completionUtils';
import {ReplConnection} from './replConnection';

export class ClojureDocumentFormattingEditProvider implements DocumentFormattingEditProvider{
	private connection: ReplConnection;

  constructor(conn: ReplConnection) {
    this.connection = conn;
  }

	public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): Thenable<TextEdit[]> {
		let self = this;
    let codeString = document.getText();

		let rval = new Promise<TextEdit[]>((resolve, reject) => {
			// Use the REPL to find the definition point
        if (self.connection.isConnected()) {
					self.connection.reformat(codeString, (err: any, result: any) => {

            if (result && result.length > 0) {
              var def: Location[] = [];
              let res = result[0];
              if (res["code"]) {
								// replace the whole document
								let range = new Range(new Position(0,0), new Position(document.lineCount - 1, 1000000));

								let edit = TextEdit.replace(range, res["code"]);

								resolve([edit]);
              }

            } else {
              reject(err);
            }
          });
        } else {
          // The next line is commented out because it was triggering too ofter due to the
          // many ways a definition can be asked for. Re-enable it if this changes.
          //window.showErrorMessage("Please launch or attach to a REPL to enable definitions.")
          reject(undefined);
        }
		});

		return rval;
	}
}

