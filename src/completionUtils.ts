import {CompletionItem, CompletionItemKind} from 'vscode';
import edn = require('jsedn');

// Functions to work with completions from Compliment

export namespace CompletionUtils {
  // TODO find all the types returned by Compliment and add entries for them
  let typeMap: Map<edn.Keyword, CompletionItemKind> = new Map<edn.Keyword, CompletionItemKind>();
  typeMap.set(edn.kw(":function"), CompletionItemKind.Function);
  typeMap.set(edn.kw(":local"), CompletionItemKind.Variable);
  // TODO request macro be added as a CompletionItemKind
  typeMap.set(edn.kw(":macro"), CompletionItemKind.Method);
  typeMap.set(edn.kw(":namespace"), CompletionItemKind.Module);
  typeMap.set(edn.kw(":class"), CompletionItemKind.Class);
  // Don't know what to use for vars. Maybe I should request a constant type be added to CompletionItemKind.
  typeMap.set(edn.kw(":var"), CompletionItemKind.Value);
  // TODO don't know if :protocol is actually a type returned by Compliment
  typeMap.set(edn.kw(":protocol"), CompletionItemKind.Interface);
  // TODO maybe find a better type
  typeMap.set(edn.kw(":special-form"), CompletionItemKind.Keyword);

 /**
  * Returns a CompletionItemKind that corresponds to the given type returned by Compliment.
 * @param type  And edn.Keyword representing the type of the completion (function, variable, etc.).
 */
  export function typeKeywordToCompletionItemKind(type: edn.Keyword): CompletionItemKind {
    var kind = typeMap.get(type) || CompletionItemKind.Text;

    return kind;
  }


   /**
    * Escapes the Clojure code and places it in quotations.
    * */
  export function complimentResultsToCompletionItems(completionsEdn: string): CompletionItem[] {
    var results = [];
    if (completionsEdn != null) {
      var res = edn.parse(completionsEdn);
      results = res.each((candidateMap: any) => {
        let candidate: string = candidateMap.at(edn.kw(":candidate"));
        if (candidate == "false") {
          console.log("false");
        }
        let cType: edn.Keyword = candidateMap.at(edn.kw(":type"));
        var type = edn.toJS(cType);
        type = type.replace(":","");
        var doc:  string = candidateMap.at(edn.kw(":docs"));
        doc = doc.replace(/\\n/g,"\n");
        var ns: string = "";
        if (candidateMap.exists(edn.kw(":ns"))) {
          ns = candidateMap.at(edn.kw(":ns"));
        }

        let ci =  new CompletionItem(candidate);
        ci.kind = typeKeywordToCompletionItemKind(cType);
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