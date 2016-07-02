import {TextEditor, Range, Position, window} from 'vscode';

// Functions based on editor utils in proto-repl https://github.com/jasongilman/proto-repl

export namespace EditorUtils {
  // Escapes the Clojure code and places it in quotations
  export function escapeClojureCodeInString(code: string): string {
   let escaped = code.replace(/\\/g,"\\\\").replace(/"/g, "\\\"");
   return `\"${escaped}\"`;
  }

  export function getTopLevelForms(editor: TextEditor): Range[] {
    var forms: Range[];

    for (var i=0; i < editor.document.lineCount; i++) {
      let line = editor.document.lineAt(0);
      if (!line.isEmptyOrWhitespace) {
        // look for open or close parens/brackets or ;
        var inString = false;
        for (var j=0; j < line.text.length; j++) {
          let c = line.text.charAt(j);
          //if (c)
          if (["(", "[", "{"].indexOf(c) != -1) {

          }
        }
      }
    }

    return forms;
  }

 // Find the symbol under the cursor
 export function getSymobleUnderCursor(){
   var editor = window.activeTextEditor;
  if (!editor) {
    return; // No open text editor
  }
  var position = editor.selection.active;
  let wordRange = editor.document.getWordRangeAtPosition(position);
  var sym = editor.document.getText(wordRange);
  return sym;
 }

 // Finds a Clojure Namespace declaration in the editor and returns the name
 // of the namespace.
  export function findNSDeclaration(code: string) {
    let regex = /\(ns ([^\s\)]+)/;
    var ns = null;

    let match = regex.exec(code);
    if (match) {
      ns = match[1];
    }

    return ns;
  }

  // Find the namespace for the currently open file
  export function findNSForCurrentEditor(): string {
    // get the contents of the current edtior
    var editor = window.activeTextEditor;
    if (!editor) {
      return; // No open text editor
    }

    var text = editor.document.getText();

    return findNSDeclaration(text);
  }


}