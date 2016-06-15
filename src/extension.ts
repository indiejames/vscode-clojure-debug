/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';

import { workspace, languages, commands, CompletionItemProvider, Disposable, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
import nrepl_client = require('jg-nrepl-client');
import {ReplConnection} from './replConnection';
import {spawn} from 'child_process';
import {ClojureCompletionItemProvider} from './clojureCompletionItemProvider';
import {ClojureDefinitionProvider} from './clojureDefinitionProvider';
import edn = require('jsedn');
import {} from 'languages';

var extensionInitialized = false;

export function activate(context: ExtensionContext) {
	console.log("Starting Clojure extension...");
	let repl_port = 7777;
	var isInitialized = false;
	let regexp = new RegExp('nREPL server started on port');
	var rconn: ReplConnection;
	let env = {};
	// let cwd = "/Users/jnorton/Clojure/repl_test";
	// let repl = spawn('/usr/local/bin/lein', ["repl", ":headless", ":port", "" + repl_port], {cwd: cwd, env: env});

	// use default completions if none are available from Compliment
	//context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new CompletionItemProvider()))

	rconn = new ReplConnection("127.0.0.1", repl_port);
	rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
		if (!extensionInitialized) {
			extensionInitialized = true;
			context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new ClojureCompletionItemProvider(rconn), ""));
			context.subscriptions.push(languages.registerDefinitionProvider("clojure", new ClojureDefinitionProvider(rconn)));
			console.log("Compliment namespace loaded");
		}

	});

	// repl.stderr.on('data', (data) => {
	// 	var output = '' + data;
	// 	console.log('STDERR: ' + output);
	// });

	// repl.stdout.on('data', (data) => {
	// 	var output = '' + data;
	// 	console.log('STDOUT: ' + output);

	// 	if (!isInitialized && regexp.test(output)) {
	// 		console.log("Connecting to nREPL...");
	// 		isInitialized = true;
	// 		rconn = nrepl_client.connect({port: repl_port, host: "127.0.0.1", verbose: false});
	// 		rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
	// 			context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new ClojureCompletionItemProvider(rconn), ""));
	// 			context.subscriptions.push(languages.registerDefinitionProvider("clojure", new ClojureDefinitionProvider(rconn)));
	// 			// TODO move code into here so we can wait for this eval to finish
	// 			console.log("Namespace loaded");
	// 		});
	// 	} else {
	// 		console.log("Not connecting");
	// 	}
	// });

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };

	// If the extension is launched in debug mode the debug server options are used.
	// Otherwise the run options are used.
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: ['clojure'],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'languageServerExample',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}

	// Create the language client and start the client.
	let client = new LanguageClient('Language Server Example', serverOptions, clientOptions);
	let disposable = client.start();
	let promise = client.onReady();
	// promise.then(() => {

	// 		let rconn = nrepl_client.connect({port: repl_port, host: "127.0.0.1", verbose: false});
	// 		rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
	// 		// TODO move code into here so we can wait for this eval to finish
	// 		});
	// });
	// client.onReady(() => void {

	// });

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation

	context.subscriptions.push(commands.registerCommand('clojure.refresh', () => {
		rconn.refresh((err: any, result: any) => {
		// TODO handle errors here
		console.log("Refreshed Clojure code.");
    });
	}));

	context.subscriptions.push(disposable);


	console.log("Clojure extension active");
}