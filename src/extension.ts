/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import http = require('http');
import s = require('socket.io');
import { window, workspace, languages, commands, OutputChannel, Range, CompletionItemProvider, Disposable, ExtensionContext, LanguageConfiguration, StatusBarItem, TextEditor } from 'vscode';
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
var activeEditor = null;

var exceptionBreakpointClassItem: StatusBarItem;

var activeReplActions: Disposable[] = null;

var refreshOnLaunch = true;

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
		// TOD standardize the message handling (some are under 'eval' others are direct)

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

function initSideChannel(context: ExtensionContext, sideChannelPort: number){
	// start up a side channel that the debug adapter can use to query the extension

	console.log("Setting up side channel on port " + sideChannelPort);
	window.setStatusBarMessage("Setting up side channel on port " + sideChannelPort);

	var sideChannel = s(sideChannelPort);
	sideChannel.on('connection', (sock) => {

		sock.on('connect-to-repl', (hostPortString) => {
			var host, port;
			[host, port] = hostPortString.split(":");
			connect(context, sock, host, port);

		});

		sock.on('get-breakpoint-exception-class', () => {
			const itemStr = exceptionBreakpointClassItem.text;
			const classStr = itemStr.substr(8, itemStr.length);
			sock.emit('get-breakpoint-exception-class-result', classStr)
		});

		sock.on('get-source-paths', (paths) => {
			console.log("Getting source paths");
			rconn.getSourcePaths(paths, (err: any, result: any) => {
				if (err) {
					sock.emit('source-path-result', err);
				} else {
					sock.emit('source-path-result', result);
				}
			});
		});

		sock.on('eval-code', (code) => {
			console.log("Evaluating code");
			window.setStatusBarMessage("Evaluating Code")
			let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
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

				// Figure out how to send a newline to the terminal here to clear it's input

				// fall through

			case 'exit':
				removeReplActions(context);

				rconn.close((err: any, msg: any) : any => {
					console.log("Connection closed)");
				});

				break;

			case 'get-namespace':
				sock.emit('get-namespace-result', EditorUtils.findNSForCurrentEditor(activeEditor));
				break;

			case 'load-namespace':
				let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
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

// Set up actions that work without the REPL
function setUpActions(context: ExtensionContext) {
	context.subscriptions.push(languages.setLanguageConfiguration("clojure", languageConfiguration));
	context.subscriptions.push(commands.registerCommand('clojure.expand_selection', () => {
		EditorUtils.selectBrackets(activeEditor);
	}));
}

function removeReplActions(context: ExtensionContext) {
	exceptionBreakpointClassItem.dispose();
	exceptionBreakpointClassItem = null;

	if (activeReplActions) {
		for (var disposable of activeReplActions) {
			let index = context.subscriptions.indexOf(disposable, 0);
			if (index > -1) {
				context.subscriptions.splice(index, 1);
			}
			disposable.dispose();
		}

		activeReplActions = null;
	}
}

function setUpReplActions(context: ExtensionContext, rconn: ReplConnection){
	let cfg = workspace.getConfiguration("clojure");

	exceptionBreakpointClassItem = window.createStatusBarItem();
	exceptionBreakpointClassItem.text = "$(stop) Throwable"
	exceptionBreakpointClassItem.command = "clojure.setExceptionBreakpointClass";
	exceptionBreakpointClassItem.show();

	activeReplActions = [];

	activeReplActions.push(languages.registerCompletionItemProvider("clojure", new ClojureCompletionItemProvider(rconn), ""));
	activeReplActions.push(languages.registerDefinitionProvider("clojure", new ClojureDefinitionProvider(rconn)));
	activeReplActions.push(languages.registerHoverProvider("clojure", new ClojureHoverProvider(rconn)));

	////////////////////////////////////////////////////

	activeReplActions.push(commands.registerCommand('clojure.eval', () => {
		// only support evaluating selected text for now.
		// See https://github.com/indiejames/vscode-clojure-debug/issues/39.
		let editor = window.activeTextEditor;
		let selection = editor.selection;
		let range = new Range(selection.start, selection.end);
		let code = editor.document.getText(range);
		let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
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

	activeReplActions.push(commands.registerCommand('clojure.setExceptionBreakpointClass', () => {
		const input = window.showInputBox({prompt: "Exception Class"});
		input.then(value => {
			exceptionBreakpointClassItem.text = "$(stop) " + value;
			// reapply breakpoints to update exception breakpoints
			const com = commands.executeCommand("workbench.debug.viewlet.action.reapplyBreakpointsAction");
			com.then(value => {
				console.log(value);
			}, rejected => {
				console.error(rejected);
			});
		})}));

	activeReplActions.push(commands.registerCommand('clojure.refresh', () => {
		console.log("Calling refresh...")
		rconn.refresh((err: any, result: any) : void => {
			// TODO handle errors here
			// reapply the breakpoints since they will have been invalidated on any reloaded code
			const com = commands.executeCommand("workbench.debug.viewlet.action.reapplyBreakpointsAction");
			com.then(value => {
				console.log(value);
				console.log("Refreshed Clojure code.");
			}, rejected => {
				console.error(rejected);
			});
		});
	}));

	// TODO create a test runner class and move these to it
	activeReplActions.push(commands.registerCommand('clojure.run-all-tests', () => {
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

	activeReplActions.push(commands.registerCommand('clojure.run-test-file', () => {
		let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
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

	activeReplActions.push(commands.registerCommand('clojure.run-test', () => {
		let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
		let test = EditorUtils.getSymobleUnderCursor(activeEditor);
		if (cfg.get("refreshNamespacesBeforeRunnningTest") === true) {
			rconn.refresh((err: any, result: any) => {
				rconn.runTest(ns, test, (err: any, result: any) => {
					outputChannel.append(result);
					console.log("Test " + test + " run.");
				});
			});
		} else {
			rconn.runTest(ns, test, (err: any, result: any) => {
				console.log("Test " + test + " run.");
			});
		}
	}));

	context.subscriptions.concat(activeReplActions);

}

// Create a connection to the debugged process and run some init code
function connect(context: ExtensionContext, sock:SocketIO.Socket, host: string, port: number) {
	console.log("Attaching to debugged process");
	window.setStatusBarMessage("Attaching to debugged process");
	let cfg = workspace.getConfiguration("clojure");

	rconn.connect(host, port, (err: any, result: any) => {
		if (refreshOnLaunch) {
			rconn.refresh((err: any, result: any) => {
				if (err) {
					console.error(err);
				} else {
					outputChannel.appendLine(result);
					rconn.eval("(use 'compliment.core)", (err: any, result: any) => {
						outputChannel.appendLine(result);
						console.log("Compliment namespace loaded");
						setUpReplActions(context, rconn);
						sock.emit("connect-to-repl-complete", {});

						window.setStatusBarMessage("Attached to process");
					});
				}
			});
		}
	});
}

export function activate(context: ExtensionContext) {
	console.log("Starting Clojure extension...");
	let cfg = workspace.getConfiguration("clojure");
	window.setStatusBarMessage("Activating Extension");

	outputChannel = window.createOutputChannel("Clojure");

	// Keep track of the active file editor so we can execute code in the namespace currently
	// being edited. This is necessary because as of VS Code 1.5 the input to the debugger
	// gets returned by workspace.currentEditor when you type in it.
	activeEditor = window.activeTextEditor;

	window.onDidChangeActiveTextEditor((e: TextEditor) : any => {
		let doc = e.document;
		let fileName = doc.fileName;

		// don't count the debugger input as a text editor. this is used to get the namespace
		// in which to execute input code, so we only want to use actual file editors
		if (fileName != "input") {
			activeEditor = e;
		}
	});

	// read the launch.json file to get the side channel port
	let launchJsonPath = join(workspace.rootPath, ".vscode", "launch.json");
	let launchJsonStr = readFileSync(launchJsonPath).toString();
	let launchJson = JSON.parse(stripJsonComments(launchJsonStr));
	let sideChannelPort: number = launchJson["configurations"][0]["sideChannelPort"];
  let refresh = launchJson["configurations"][0]["refreshOnLaunch"];
	if (refresh == false) {
		refreshOnLaunch = false;
	} else {
		refreshOnLaunch = true;
	}

  // Create the connection object but don't connect yet
	rconn = new ReplConnection();

	setUpActions(context);

	initSideChannel(context, sideChannelPort);

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