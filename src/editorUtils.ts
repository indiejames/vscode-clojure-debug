import {TextEditor, Range, Position} from 'vscode';

// Functions based on editor utils in proto-repl https://github.com/jasongilman/proto-repl

export namespace EditorUtils {
  // Escapes the Clojure code and places it in quotations
  export function escapeClojureCodeInString(code: string): string {
   let escaped = code.replace(/\\/g,"\\\\").replace(/"/g, "\\\"");
   return `\"${escaped}\"`;
  }
  
  function isIgnorableBrace(editor: TextEditor, position: Position) {
    
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
  
  
}  