import {CompletionItem, CompletionItemKind} from 'vscode';
import edn = require('jsedn');

// Functions to work with completions from Compliment

export namespace CompletionUtils {
  // TODO find all the types returned by Compliment and add entries for them
  let typeMap: Map<string, CompletionItemKind> = new Map<string, CompletionItemKind>();
  typeMap.set("function", CompletionItemKind.Function);
  typeMap.set("local", CompletionItemKind.Variable);
  // TODO request macro be added as a CompletionItemKind
  typeMap.set("macro", CompletionItemKind.Method);
  typeMap.set("namespace", CompletionItemKind.Module);
  typeMap.set("class", CompletionItemKind.Class);
  // Don't know what to use for vars. Maybe I should request a constant type be added to CompletionItemKind.
  typeMap.set("var", CompletionItemKind.Value);
  // TODO don't know if :protocol is actually a type returned by Compliment
  typeMap.set("protocol", CompletionItemKind.Interface);
  // TODO maybe find a better type
  typeMap.set("special-form", CompletionItemKind.Keyword);

 /**
  * Returns a CompletionItemKind that corresponds to the given type returned by Compliment.
 * @param type  And string representing the type of the completion (function, variable, etc.).
 */
  export function typeKeywordToCompletionItemKind(type: string): CompletionItemKind {
    var kind = typeMap.get(type) || CompletionItemKind.Text;

    return kind;
  }


   /**
    * Converts a completion candidate from Compliment to a VSCode one.
    * */
  export function complimentResultsToCompletionItems(completions: any): CompletionItem[] {
    var results = [];
    if (completions != null) {
      results = completions.map((candidateMap: any) => {
        let candidate: string = candidateMap["candidate"];
        let type: string = candidateMap["type"];
        var doc:  string = candidateMap["docs"];
        doc = doc.replace(/\\n/g,"\n");
        var ns: string = candidateMap["ns"];
        if (ns == null) {
          ns = "";
        }

        let ci =  new CompletionItem(candidate);
        ci.kind = typeKeywordToCompletionItemKind(type);
        if (doc != "") {
          ci.documentation = doc;
        }
        if (ns != "") {
          ci.detail = `${type} ${ns}/${candidate}`;
        } else {
          ci.detail = `${type} ${candidate}`;
        }

        return ci;
      });
    }
   return results;
  }
}