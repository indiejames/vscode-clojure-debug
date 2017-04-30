import {TextEditor, TextDocument, Range, Position, Selection, window, workspace} from 'vscode';
import {basename, dirname, join, sep} from 'path';
let find = require('find');

// Functions based on editor utils in proto-repl https://github.com/jasongilman/proto-repl

export namespace PathResolution {

	export let clientSrcPaths: any = {};

	// Get the full path to a source file. Input paths are of the form repl_test/core.clj.
	// The path is usually not an absolute path, e.g., repl_test/core.clj, so this is
	// necessarily not perfect as there may be more than one match.
	export function convertDebuggerPathToClientPath(debuggerPath: string, line: number): string {
		let rval = null;
		if (debuggerPath.substr(0, 1) == "/") {
			rval = debuggerPath;
		} else {

				// check our cache
			if (clientSrcPaths[debuggerPath]) {
				rval = clientSrcPaths[debuggerPath];
			}

			if (rval == null) {
				// brute force search the workspace for matches and then the tmp jars directories
				let regex = new RegExp(".*?" + debuggerPath);
				let files = find.fileSync(regex, workspace.rootPath);
				rval = files[0];

				if (rval == null) {
					// check the tmp jars directories
					const home = process.env["HOME"];
					files = find.fileSync(regex, home + sep +  ".lein" + sep + "tmp-vscode-jars")
					rval = files[0];
				}
			}

			if (rval == null) {
				rval = "";
			}

			clientSrcPaths[debuggerPath] = rval;

			return rval;
		}
	}
}