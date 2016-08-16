/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import http = require('http');
import s = require('socket.io');
import { window, workspace, languages, commands, OutputChannel, Range, CompletionItemProvider, Disposable, ExtensionContext, LanguageConfiguration } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
import nrepl_client = require('jg-nrepl-client');
import {ReplConnection} from './replConnection';
import {spawn} from 'child_process';
import {ClojureCompletionItemProvider} from './clojureCompletionItemProvider';
import {ClojureDefinitionProvider} from './clojureDefinitionProvider';
import {ClojureHoverProvider} from './clojureHoverProvider';
import {EditorUtils} from './editorUtils';
import edn = require('jsedn');
import {} from 'languages';

const languageConfiguration: LanguageConfiguration = {
	comments: {
		"lineComment": ";"
	},
	brackets: [
		["{", "}"],
		["[", "]"],
		["(", ")"]
	],
	wordPattern: /[^\s()"',;~@#$%^&{}\[\]\\`\n]+/g
}

var extensionInitialized = false;
var debuggedProcessLaunched = false;
var rconn: ReplConnection;
var outputChannel: any;
var extensionDir: String;

function handleEvalResponse(response: Array<any>, outputChannel: OutputChannel) {
	for (var resp of response) {
		// TODO handle errors here

		if (resp["out"]) {
			outputChannel.append(resp["out"] + "\n");
		}

		if (resp["value"]) {
			var ns = "user";
			if (resp["ns"]) {
				ns = resp["ns"];
			}
			outputChannel.append(ns + "=> " + resp["value"] + "\n");
		}
	}
}

export function activate(context: ExtensionContext) {
	console.log("Starting Clojure extension...");
	let cfg = workspace.getConfiguration("clojure");
	extensionDir = context.extensionPath;
	window.setStatusBarMessage("Activating Extension");

	// var outputChannel = window.createOutputChannel("Clojure REPL");
	// outputChannel.show(true);
	console.log("Setting up side channel on port 3030");
	window.setStatusBarMessage("Setting up side channel on port 3030");
	// start up a side channel that the debug adapter can use to query the extension
	let sideChannelPort = cfg.get("sideChannelPort", 3030);
	var sideChannel = s(sideChannelPort);
	sideChannel.on('connection', (sock) => {

		sock.on('eval-code', (code) => {
			console.log("Evaluating code");
			window.setStatusBarMessage("Evaluating Code")
			let ns = EditorUtils.findNSForCurrentEditor();
			rconn.eval(code, (err: any, result: any) => {
				console.log("Code evaluated");
				window.setStatusBarMessage("Code Evaluated");
				if (err){
					sock.emit('eval-code-result', err);
				} else {
					sock.emit('eval-code-result', result);
				}
			}, ns);
		});

		sock.on('eval', (code) => {
			switch (code) {
			case 'get-namespace':
				sock.emit('namespace-result', EditorUtils.findNSForCurrentEditor());
				break;
			case 'load-namespace':
				let ns = EditorUtils.findNSForCurrentEditor();
				rconn.eval("(require '" + ns + ")", (err: any, result: any) => {
					sock.emit('load-namespace-result')
				});
				break;
			case 'get-extension-directory':
			 	sock.emit('get-extension-directory-result', context.extensionPath);
				 break;
		    case 'attach':
				console.log("Attaching to debugged process");
				window.setStatusBarMessage("Attaching to debugged process");
				// TODO Get this from config
				let repl_port = 7777;
  				let env = {};

				var isInitialized = false;
				let regexp = new RegExp('nREPL server started on port');


				// let cwd = "/Users/jnorton/Clojure/repl_test";
				// let repl = spawn('/usr/local/bin/lein', ["repl", ":headless", ":port", "" + repl_port], {cwd: cwd, env: env});

				// use default completions if none are available from Compliment
				//context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new CompletionItemProvider()))

				rconn = new ReplConnection("127.0.0.1", repl_port);
				rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
					// if (extensionInitialized) {
					// 	// deregister old providers
					// 	context.subscriptions.
					// }
					// if (!extensionInitialized) {
						extensionInitialized = true;
						context.subscriptions.push(languages.setLanguageConfiguration("clojure", languageConfiguration));
						context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new ClojureCompletionItemProvider(rconn), ""));
						context.subscriptions.push(languages.registerDefinitionProvider("clojure", new ClojureDefinitionProvider(rconn)));
						context.subscriptions.push(languages.registerHoverProvider("clojure", new ClojureHoverProvider(rconn)));
						console.log("Compliment namespace loaded");

						////////////////////////////////////////////////////


						context.subscriptions.push(commands.registerCommand('clojure.eval', () => {
							// only support evaluating select text for now.
							// See https://github.com/indiejames/vscode-clojure-debug/issues/39.
							let editor = window.activeTextEditor;
							let selection = editor.selection;
							let range = new Range(selection.start, selection.end);
							let code = editor.document.getText(range);
							let ns = EditorUtils.findNSForCurrentEditor();
							if (ns) {
								rconn.eval(code, (err: any, result: any) : void => {
									handleEvalResponse(result, outputChannel);
								}, ns);
							} else {
								rconn.eval(code, (err: any, result: any) : void => {
									handleEvalResponse(result, outputChannel);
								});
							}

						}));

						context.subscriptions.push(commands.registerCommand('clojure.refresh', () => {
							console.log("Calling refresh...")
							rconn.refresh((err: any, result: any) : void => {
								// TODO handle errors here
								console.log("Refreshed Clojure code.");
								});
						}));

						// TODO create a test runner class and move these to it
						context.subscriptions.push(commands.registerCommand('clojure.run-all-tests', () => {
							if (cfg.get("refreshNamespacesBeforeRunnningAllTests") === true) {
								console.log("Calling refresh...")
								rconn.refresh((err: any, result: any) : void => {
									// TODO handle errors here
									console.log("Refreshed Clojure code.");
									rconn.runAllTests((err: any, result: any) : void => {
										console.log("All tests run.");
									});
								});
							} else {
								rconn.runAllTests((err: any, result: any) : void => {
									console.log("All tests run.");
								});
							}
						}));

						context.subscriptions.push(commands.registerCommand('clojure.run-test-file', () => {
							let ns = EditorUtils.findNSForCurrentEditor();
							if (cfg.get("refreshNamespacesBeforeRunnningTestNamespace") === true) {
								rconn.refresh((err: any, result: any) => {
									console.log("Refreshed Clojure code.");
									rconn.runTestsInNS(ns, (err: any, result: any) => {
										console.log("Tests for namespace " + ns + " run.");
									});
								});
							} else {
								rconn.runTestsInNS(ns, (err: any, result: any) => {
										console.log("Tests for ns " + ns + " run.");
									});
							}
						}));

						context.subscriptions.push(commands.registerCommand('clojure.run-test', () => {
							let ns = EditorUtils.findNSForCurrentEditor();
							let test = EditorUtils.getSymobleUnderCursor();
							if (cfg.get("refreshNamespacesBeforeRunnningTest") === true) {
								rconn.refresh((err: any, result: any) => {
									rconn.runTest(ns, test, (err: any, result: any) => {
										console.log("Test " + test + " run.");
									});
								});
							} else {
								rconn.runTest(ns, test, (err: any, result: any) => {
										console.log("Test " + test + " run.");
									});
							}
						}));


						///////////////////////////////////////////////////

					// }
					window.setStatusBarMessage("Attached to process");

				});
				break;

				default: console.error("Unknown side channel request");
			}
		});

		sock.emit('go-eval', {});
	});



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

	context.subscriptions.push(commands.registerCommand('clojure.expand_selection', () => {
		EditorUtils.selectBrackets();
	}));



	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);

	console.log("Clojure extension active");
	window.setStatusBarMessage("Clojure extension active");
}