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
import {readFileSync} from 'fs-extra';
import {join} from 'path';
import stripJsonComments = require('strip-json-comments');
import {spawn} from 'child_process';
import {ClojureCompletionItemProvider} from './clojureCompletionItemProvider';
import {ClojureDefinitionProvider} from './clojureDefinitionProvider';
import {ClojureHoverProvider} from './clojureHoverProvider';
import {EditorUtils} from './editorUtils';
import edn = require('jsedn');
import {} from 'languages';

let EXIT_CMD = "(System/exit 0)";

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

function initSideChannel(sideChannelPort: number){
	// start up a side channel that the debug adapter can use to query the extension

	console.log("Setting up side channel on port " + sideChannelPort);
	window.setStatusBarMessage("Setting up side channel on port " + sideChannelPort);

	var sideChannel = s(sideChannelPort);
	sideChannel.on('connection', (sock) => {

		sock.on('connect-to-repl', (hostPortString) => {
			var host, port;
			[host, port] = hostPortString.split(":");
			connect(host, port);
		});

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

		sock.on('eval', (action) => {
			switch (action) {
			case 'terminate-and-exit':
			  rconn.eval(EXIT_CMD, (err: any, result: any): void => {
					// This is never called, apparently.
					console.log("debugged process killed")
				});

				// fall through

			case 'exit':
				rconn.close((err: any, msg: any) : any => {
					console.log("Connection closed)");
				});

				break;

			case 'get-namespace':
				sock.emit('namespace-result', EditorUtils.findNSForCurrentEditor());
				break;

			case 'load-namespace':
				let ns = EditorUtils.findNSForCurrentEditor();
				rconn.eval("(require '" + ns + ")", (err: any, result: any) => {
					sock.emit('load-namespace-result')
				});
				break;

			default: console.error("Unknown side channel request");
			}
		});

		sock.emit('go-eval', {});
	});
}

function setUpActions(context: ExtensionContext, rconn: ReplConnection){
	let cfg = workspace.getConfiguration("clojure");

	context.subscriptions.push(languages.setLanguageConfiguration("clojure", languageConfiguration));
	context.subscriptions.push(languages.registerCompletionItemProvider("clojure", new ClojureCompletionItemProvider(rconn), ""));
	context.subscriptions.push(languages.registerDefinitionProvider("clojure", new ClojureDefinitionProvider(rconn)));
	context.subscriptions.push(languages.registerHoverProvider("clojure", new ClojureHoverProvider(rconn)));
  context.subscriptions.push(commands.registerCommand('clojure.expand_selection', () => {
		EditorUtils.selectBrackets();
	}));

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
}

// Create a connection to the debugged process and run some init code
function connect(host: string, port: number) {
	console.log("Attaching to debugged process");
	window.setStatusBarMessage("Attaching to debugged process");
	let cfg = workspace.getConfiguration("clojure");

	rconn.connect(host, port, (err: any, result: any) => {
		// TODO make this configurable or get config from debugger launch config
		rconn.refresh((err: any, result: any) => {
			if (err) {
				console.error(err);
			} else {
				rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
					console.log("Compliment namespace loaded");
					window.setStatusBarMessage("Attached to process");
				});
			}
		});
	});
}

export function activate(context: ExtensionContext) {
	console.log("Starting Clojure extension...");
	let cfg = workspace.getConfiguration("clojure");
	window.setStatusBarMessage("Activating Extension");

	// read the launch.json file to get the side channel port
	let launchJsonPath = join(workspace.rootPath, ".vscode", "launch.json");
  let launchJsonStr = readFileSync(launchJsonPath).toString();
  let launchJson = JSON.parse(stripJsonComments(launchJsonStr));
  let sideChannelPort: number = launchJson["configurations"][0]["sideChannelPort"];

  // Create the connection object but don't connect yet
	rconn = new ReplConnection();

	setUpActions(context, rconn);

	initSideChannel(sideChannelPort);

	// The server is implemented in node
	// let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
	// // The debug options for the server
	// let debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };

	// // If the extension is launched in debug mode the debug server options are used.
	// // Otherwise the run options are used.
	// let serverOptions: ServerOptions = {
	// 	run : { module: serverModule, transport: TransportKind.ipc },
	// 	debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	// }

	// Options to control the language client
	// let clientOptions: LanguageClientOptions = {
	// 	// Register the server for plain text documents
	// 	documentSelector: ['clojure'],
	// 	synchronize: {
	// 		// Synchronize the setting section 'languageServerExample' to the server
	// 		configurationSection: 'languageServerExample',
	// 		// Notify the server about file changes to '.clientrc files contain in the workspace
	// 		fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
	// 	}
	// }

	// Create the language client and start the client.
	// let client = new LanguageClient('Language Server Example', serverOptions, clientOptions);
	// let disposable = client.start();
	// let promise = client.onReady();

	// Push the disposable to the context's subscriptions so that the
	// client can be deactivated on extension deactivation
	// context.subscriptions.push(disposable);

	console.log("Clojure extension active");
	window.setStatusBarMessage("Clojure extension active");
}

export function deactivate(context: ExtensionContext){
	context.subscriptions = [];
}