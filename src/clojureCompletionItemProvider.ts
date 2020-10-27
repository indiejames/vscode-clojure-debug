/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {CompletionItemProvider, CompletionList, CompletionItem, CompletionItemKind, CancellationToken, TextDocument, Position} from 'vscode';
import nrepl_client = require('nrepl-client');
import edn = require('jsedn');
import {EditorUtils} from './editorUtils';
import {CompletionUtils} from './completionUtils';
import {ReplConnection} from './replConnection';
let chalk = require("chalk");
let core = require('core-js/library');

// combine to arrays of CompletionItems by adding all the items from the second array that are not already represented
// in the first array to the first array
function joinAndRemoveDuplicates(list1: Array<CompletionItem>, list2: Array<CompletionItem>): Array<CompletionItem> {

  let rval = list1;

  let terms = list1.map((val: CompletionItem): string => {
    return val.label;
  });

  for (var ci of list2) {
    if (terms.indexOf(ci.label) == -1) {
      rval.push(ci);
    }
  }
  return rval;
}

export class ClojureCompletionItemProvider implements CompletionItemProvider {

  private connection: ReplConnection;

  constructor(conn: ReplConnection) {
    this.connection = conn;
  }

  private completionsParams(document: TextDocument, position: Position): [string, string, string, number] {
    let fileContents = document.getText();
    var ns = EditorUtils.findNSDeclaration(fileContents);
    if (ns == null) {
      ns = "user";
    }
    let prefixRange = document.getWordRangeAtPosition(position);
    var prefix = "";
    if (prefixRange != null) {
      prefix = document.getText(prefixRange);
    }
    let offset = document.offsetAt(position) - 1;
    var src = fileContents.substring(0, offset) + "__prefix__" + fileContents.substring(offset + prefix.length);
    src = EditorUtils.escapeClojureCodeInString(src);

    return [src, ns, prefix, offset];
  }

	public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionList> {
    let self = this;
    // Get the parameters needed for completion
    let [src, ns, prefix, offset] = self.completionsParams(document, position);

    let rval = null;

    if (prefix == "") {
      rval = Promise.resolve(new CompletionList([], true));
    } else {
      rval = new Promise<CompletionList>((resolve, reject) => {

        // Sometimes vscode freaks out and sends the whole source as the prefix
        // so I check for newlines and reject them here.
        if (prefix == "") {
          let ci =  new CompletionItem("");
          resolve(new CompletionList([], true));
        } else {

          // get string match completions
          let allWords = src.match(/[^\s\(\)"',;~@#$%^&{}\[\]\\`\n]+/g);
          let wordSet = new core.Set(allWords);
          let words = core.Array.from(wordSet);

          // find the actual matching words
          let matches = words.filter((val: string): boolean => {
            return (val.substr(0, prefix.length) == prefix);
          }).sort();

          let textCompletions = matches.map((val: string) => {
            let ci =  new CompletionItem(val);
            ci.kind = CompletionItemKind.Text;
            return ci;
          });

          // Call Compliment to get the completions
          // TODO - add optimization to check the length of the prefix and set isInComplete in the CompletionList
          // to false if the length is > 3 chars (or whatever length namespace show up in the list at).
          self.connection.findCompletions(ns, prefix, src, offset, (err: any, result: any) => {
            if (result && result.length > 0) {
              let results = CompletionUtils.complimentResultsToCompletionItems(result[0]["completions"]);
              if (results != null) {
                let completionList = new CompletionList(joinAndRemoveDuplicates(results, textCompletions), true);
                completionList.isIncomplete = true;
                resolve(completionList);
              } else {
                resolve(new CompletionList([], true));
              }
            } else {
              //reject(err);
              resolve(new CompletionList([], true));
            }
          });
        }
      });
    }

    return rval;
  }
}