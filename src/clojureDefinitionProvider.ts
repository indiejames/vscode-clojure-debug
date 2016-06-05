import {DefinitionProvider, Definition, Location, TextDocument, Position, Uri, CancellationToken} from 'vscode';
import nrepl_client = require('jg-nrepl-client');
import edn = require('jsedn');
import {EditorUtils} from './editorUtils';
import {CompletionUtils} from './completionUtils';
let chalk = require("chalk");

export class ClojureDefinitionProvider implements DefinitionProvider {

  private connection: nrepl_client.Connection;

  constructor(conn: nrepl_client.Connection) {
    this.connection = conn;
  }

  public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Thenable<Definition> {
    let self = this;
    return new Promise<Definition>((resolve, reject) => {
      let wordRange = document.getWordRangeAtPosition(position);
      let symbol = document.getText(wordRange);

      // Use the REPL to find the definition point
      self.connection.send({op: 'find-definition', sym: symbol}, (err: any, result: any) => {
        if (result && result.length > 0) {
          var def: Location[] = [];
          let res = result[0];
          let uri = Uri.file(res["path"]);
          let line = res["line"] - 1;
          let pos = new Position(line, 0);
          def = [new Location(uri, pos)];

          resolve(def);
        } else {
          reject(err);
        }
      });
    });
  }
}