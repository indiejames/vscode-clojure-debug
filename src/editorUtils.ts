import {TextEditor, Range, Position, Selection, window} from 'vscode';

// Functions based on editor utils in proto-repl https://github.com/jasongilman/proto-repl

export namespace EditorUtils {

  export class Scope {
    type: string;
    range: Range;
    constructor(t: string, r: Range) {
      this.type = t;
      this.range = r;
    }

    containsPosition(position: Position) : boolean {
      return this.range.start.isBeforeOrEqual(position) && this.range.end.isAfterOrEqual(position);
    }
  }

  // Escapes the Clojure code and places it in quotations
  export function escapeClojureCodeInString(code: string): string {
   let escaped = code.replace(/\\/g,"\\\\").replace(/"/g, "\\\"");
   return `\"${escaped}\"`;
  }

  export function getTopLevelForms(editor: TextEditor): Range[] {
    var forms: Range[];

    for (var i=0; i < editor.document.lineCount; i++) {
      let line = editor.document.lineAt(i);
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

 // Returns true if the position is in a comment
//  export function inComment(editor: TextEditor, position: Position) {
//    let text = editor.document.getText();
//    let lines = text.split("\n");
//    let offset = editor.document.offsetAt(position);

//  }

 // Returns true if the given position is in a string
//  export function isInString(editor: TextEditor, position: Position) {
//    let offset = editor.document.offsetAt(position);
//    let text = editor.document.getText();
//     // find the position of all the quotation marks
//     var start = 0;
//     var inQuotes = false;
//     while (start != -1 && start < offset) {
//       start = text.indexOf("\"");
//       if (start != -1 && start < offset && text[start - 1] != "\\") {
//         inQuotes = !inQuotes;
//       }
//     }

//     return inQuotes;
//  }


  function makeRange(editor: TextEditor, start: number, end: number) {
    let startPos = editor.document.positionAt(start);
    let endPos = editor.document.positionAt(end);
    return new Range(startPos, endPos);
  }

  // Returns the various scopes (comment, string) for a document and their ranges
  export function getScopes(editor: TextEditor): Scope[] {
    var rval: Scope[] = new Array<Scope>();

    var inString = false;
    var inComment = false;
    var rangeStart: number;
    let text = editor.document.getText();

    // iterate over all the charactrers in the document
    for (var i = 0; i < text.length; i++) {
      let currentChar = text[i];
      if (inString) {
        if (currentChar == "\"") {
          inString = false;
          rval.push(new Scope("string", makeRange(editor, rangeStart, i)));
        }
      } else if (inComment) {
        if (currentChar == "\n") {
          inComment = false;
          rval.push(new Scope("comment", makeRange(editor, rangeStart, i)));
        }
      } else if (currentChar == "\"") {
          inString = true;
          rangeStart = i;
      } else if (currentChar == ";") {
          inComment = true;
          rangeStart = i;
      }
    }

    return rval;
  }

  function scopesContainPosition(scopes: Scope[], position: Position) {

    for (var scope of scopes) {
      if (scope.containsPosition(position)) {
        return true;
      }
    }

    return false;
  }

  //Find the innermost form containing the cursor
  export function getInnermostForm(editor: TextEditor) {
    if (!editor) {
      return; // No open text editor
    }

    let scopes = getScopes(editor);

    var position = editor.selection.active;
    let offset = editor.document.offsetAt(position);

    // find the form containg the offset
    let text = editor.document.getText();
    var start = -1;
    var end = -1;
    // find opening brace/paren
    for (var i = offset; i >= 0; i--) {
      let position = editor.document.positionAt(i);
      if (!scopesContainPosition(scopes, position)) {
        let currentChar = text[i];
        if (currentChar == "{") {
          if (i - 1 >= 0 && text[i-1] == "#") {
            start = i - 1;
          } else {
            start = i;
          }
          break;
        } else if (currentChar == "(") {
          if (i - 1 >= 0 && text[i-1] == "#") {
            start = i - 1;
          } else {
            start = i;
          }
          break;
        } else if (currentChar == "[") {
          start = i;
          break;
        }
      }
    }

    // find ending brace/paren
    for (var i=offset; i < text.length; i++) {
      let position = editor.document.positionAt(i);
      if(!scopesContainPosition(scopes, position)) {
        let currentChar = text[i];
        if (currentChar == "}" || currentChar == "]" || currentChar == ")") {
          end = i;
          break;
        }
      }
    }

    let startPos = editor.document.positionAt(start);
    let endPos = editor.document.positionAt(end);

    return editor.document.getText(new Range(startPos, endPos));

  }

  // Find the symbol under the cursor
  export function getSymobleUnderCursor(editor: TextEditor){
    if (!editor) {
      return; // No open text editor
    }
    var position = editor.selection.active;
    let wordRange = editor.document.getWordRangeAtPosition(position);
    var sym = editor.document.getText(wordRange);
    return sym;
  }

  // Find the top level form containing the cursor
  export function getTopLevelFormForCursor(editor: TextEditor) {
    if (!editor) {
        return; // No open text editor
    }
    var position = editor.selection.active;

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
    export function findNSForCurrentEditor(editor: TextEditor): string {
      // get the contents of the current edtior
      if (!editor) {
        return; // No open text editor
      }

      var text = editor.document.getText();

      return findNSDeclaration(text);
    }

    // Find the positions of the brackets that contain the given start and optional end positions.
    // Bracket in this context means parenthesis, square bracket, or squiggly bracket.
    export function findContainingBracketPositions(text: string, startPosition: number, endPosition?: number) : Array<number> {
      var startPos = startPosition;
      var endPos:number= startPosition;
      if (endPosition) {
        endPos = endPosition;
      }

      // find opening bracket
      var closingParenCount = 0;
      var closingSquareBracketCount = 0;
      var closingSquigglyBracketcount = 0;
      var pOpen;
      var pClose;

      for (pOpen = startPosition - 1; pOpen > -1; pOpen--) {
        let pChar = text[pOpen];
        if (pChar == '(') {
          if (closingParenCount == 0) {
            break;
          } else {
            closingParenCount -= 1;
          }
        }
        if (pChar == ')') {
          closingParenCount += 1;
        }
        if (pChar == '[') {
          if (closingSquareBracketCount == 0) {
            break;
          } else {
            closingSquareBracketCount -= 1;
          }
        }
        if (pChar == ']') {
          closingSquareBracketCount += 1;
        }
        if (pChar == '{') {
          if (closingSquigglyBracketcount == 0) {
            break;
          } else {
            closingSquigglyBracketcount -= 1;
          }
        }
        if (pChar == '}') {
          closingSquigglyBracketcount += 1;
        }
      }

      // Look for the closing matching bracket if we found an opening bracket
      if (pOpen != -1) {
        var openingParenCount = 0;
        var openingSquareBracketCount = 0;
        var openingSquigglyBracketCount = 0;

        for (pClose = endPos; pClose < text.length; pClose++) {
          let eChar = text[pClose];

          if (eChar == ')') {
            if (openingParenCount == 0) {
              break;
            } else {
              openingParenCount -= 1;
            }
          }
          if (eChar == '(') {
            openingParenCount += 1;
          }
          if (eChar == ']') {
            if (openingSquareBracketCount == 0) {
              break;
            } else {
              openingSquareBracketCount -= 1;
            }
          }
          if (eChar == '[') {
            openingSquareBracketCount += 1;
          }
          if (eChar == '}') {
            if (openingSquigglyBracketCount == 0) {
              break;
            } else {
              openingSquigglyBracketCount -= 1;
            }
          }
          if (eChar == '{') {
            openingSquigglyBracketCount += 1;
          }
        }

        // Sanity check to make sure bracket types match
        let oChar = text[pOpen];
        let eChar = text[pClose];
        if ((oChar == '(' && eChar == ')') || (oChar == '[' && eChar == ']') || (oChar == '{' && eChar == '}')) {
          startPos = pOpen;
          endPos = pClose + 1;
        }
      }

      return [startPos, endPos];

    }

    // Expand selection to the next-outermost brackets containing the cursor.
    // Repeated invocations will expand selection to increasingly outer brackets.
    export function selectBrackets(editor: TextEditor) {
      if (!editor) {
        return; // no open text editor
      }

      let document = editor.document;
      var startIndex = -1;
      var endIndex = document.getText().length;

      let selection = editor.selection;
      var newSelectionIndices;

      // If we have a selection and the cursor is not outside it, use it to find brackets
      if (selection.contains(selection.active)) {
        startIndex = document.offsetAt(selection.start);
        endIndex = document.offsetAt(selection.end);
        newSelectionIndices = findContainingBracketPositions(document.getText(), startIndex, endIndex);

      } else {
        startIndex = document.offsetAt(selection.active);
        newSelectionIndices = findContainingBracketPositions(document.getText(), startIndex);
      }

      let anchor = document.positionAt(newSelectionIndices[0]);
      let active = document.positionAt(newSelectionIndices[1]);
      let newSelection = new Selection(anchor, active);
      editor.selection = newSelection;
    }

    // Get the file path for the given editor
    export function getFilePath(editor: TextEditor): string {
      if (!editor) {
        return; // no open text editor
      }

      return editor.document.fileName;
    }
}