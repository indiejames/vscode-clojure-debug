/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import {join} from 'path';
import http = require('http');
import s = require('socket.io');
import { window, workspace, languages, commands, OutputChannel, Range, CompletionItemProvider, Disposable, ExtensionContext, LanguageConfiguration, StatusBarItem, TextEditor } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';
import nrepl_client = require('jg-nrepl-client');
import {ReplConnection} from './replConnection';
import {readFileSync, existsSync} from 'fs-extra';
import stripJsonComments = require('strip-json-comments');
import {exec} from 'child_process';
import {ClojureCompletionItemProvider} from './clojureCompletionItemProvider';
import {ClojureDefinitionProvider} from './clojureDefinitionProvider';
import {ClojureHoverProvider} from './clojureHoverProvider';
import {EditorUtils} from './editorUtils';
import edn = require('jsedn');
import {} from 'languages';

let EXIT_CMD = "(System/exit 0)";
var activeEditor = null;

var sideChannelSocket: SocketIO.Socket = null;

var exceptionBreakpointClassItem: StatusBarItem;

var activeReplActions: Disposable[] = null;

var refreshOnLaunch = true;
var replActionsEnabled = false;
var replRunning = false;

const languageConfiguration: LanguageConfiguration = {
	comments: {
		"lineComment": ";;"
	},
	brackets: [
		["{", "}"],
		["[", "]"],
		["(", ")"]
	],
	wordPattern: /[^\s\(\)"',;~@#$%^&{}\[\]\\`\n]+/g
}

var debuggedProcessLaunched = false;
var rconn: ReplConnection;
var outputChannel: any;
var extensionDir: String;

var lastEvalNS = "";
var lastEvalExp = "";

var evalResponse: any = {};

function handleEvalResponse(response: Array<any>) {
	window.setStatusBarMessage("Code Evaluated");

	for (var resp of response) {

		if (resp["ns"]) {
			 evalResponse["ns"] = resp["ns"];
		}

		if (resp["status"]) {
			if (resp["status"][0] == "done") {
				let ns = lastEvalNS;
				if (evalResponse["ns"]) {
					ns = evalResponse["ns"];
				}
				pout(ns + "=>")
				pout(lastEvalExp);

				if (evalResponse["ex"]) {
					perr(evalResponse["ex"])
				}
				if (evalResponse["root-ex"]) {
					perr("Root exception: " + evalResponse["root-ex"]);
				}
				if (evalResponse["out"]) {
					pout(evalResponse["out"]);
				}
				if (evalResponse["value"]) {
					pout (evalResponse["value"]);
				}
				evalResponse = {};
			}
			else if (resp["status"][0] == "eval-error") {
				evalResponse["ex"] = resp["ex"];
				evalResponse["root-ex"] = resp["root-ex"];
			}
		}

		if (resp["out"]) {
			if (evalResponse["out"] != null) {
				evalResponse["out"] = evalResponse["out"] + "\n" + resp["out"];
			} else {
				evalResponse["out"] = resp["out"];
			}
		}

		if (resp["value"]) {
			evalResponse["value"] = resp["value"];
		}
	}
}

// The following two functions are used to print to the debug console.
function pout(data: any) {
	if (sideChannelSocket && data) {
		sideChannelSocket.emit('pout', data);
	}
}

function perr(data: any) {
	if (sideChannelSocket && data) {
		sideChannelSocket.emit('perr', data);
	}
}

function initSideChannel(context: ExtensionContext, sideChannelPort: number) {
	// start up a side channel that the debug adapter can use to query the extension

	console.log("Setting up side channel on port " + sideChannelPort);
	window.setStatusBarMessage("Setting up side channel on port " + sideChannelPort);

	let sideChannel = s(sideChannelPort);
	sideChannel.on('connection', (sock) => {
		sideChannelSocket = sock;

		sock.on('connect-to-repl', (data) => {
			const reqId = data["id"];
			const hostPortString = data["hostPort"];
			var host, port;
			[host, port] = hostPortString.split(":");
			connect(context, reqId, sock, host, port);

		});

		sock.on('get-breakpoint-exception-class', (data) => {
			const reqId = data["id"];
			const itemStr = exceptionBreakpointClassItem.text;
			const classStr = itemStr.substr(8, itemStr.length);
			sock.emit('get-breakpoint-exception-class-result', {id: reqId, class: classStr});
		});

		// sock.on('get-source-paths', (paths) => {
		// 	console.log("Getting source paths");
		// 	rconn.getSourcePaths(paths, (err: any, result: any) => {
		// 		if (err) {
		// 			sock.emit('source-path-result', err);
		// 		} else {
		// 			sock.emit('source-path-result', result);
		// 		}
		// 	});
		// });

		sock.on('eval-code', (data) => {
			console.log("Evaluating code");
			window.setStatusBarMessage("$(pulse) Evaluating Code $(pulse)")
			const code = data["expression"];
			const reqId = data["id"];
			// let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
			let ns = 'user';
			rconn.eval(code, (err: any, result: any) => {
				console.log("Code evaluated");
				window.setStatusBarMessage("Code Evaluated");
				if (err){
					sock.emit('eval-code-result', {id: reqId, error: err});
				} else {
					sock.emit('eval-code-result', {id: reqId, result: result});
				}
			}, ns);
		});

		sock.on('reapply-breakpoints', (data) => {
			const reqId = data["id"];
			const com = commands.executeCommand("workbench.debug.viewlet.action.reapplyBreakpointsAction");
				com.then(value => {
					sock.emit('reapply-breakpionts-result', {id: reqId, result: value});

				}, rejected => {
					console.error(rejected);
					sock.emit('reapply-breakpionts-request', {id: reqId, error: rejected});
				});
		})

		sock.on('load-namespace', (data) => {
			const reqId = data["id"];
			const ns = data["ns"];
			rconn.eval("(require '" + ns + ")", (err: any, result: any) => {
				if (err) {
					sock.emit('load-namespace-result', {id: reqId, error: err});
				}
					sock.emit('load-namespace-result', {id: reqId});
				});
		});

		sock.on('get-workspace-root', (data) => {
			const reqId = data["id"];
			sock.emit('get-workspace-root-result', {id: reqId, result: workspace.rootPath});
		});

		sock.on('terminate-and-exit', (data) => {
			replRunning = false;
			sideChannelSocket = null;
			sideChannel.close();
			// terminate the process for the JVM
			rconn.pid((err: any, result: any): void => {
				// TODO this seems to never be reached
				const pid = result[0]["pid"];
				//exec("kill -9 " + pid);
				process.kill(pid, "SIGKILL");
				rconn.close((err: any, msg: any) : any => {
					console.log("Connection closed)");
				});
			});
		});

		sock.on('exit', (data) => {
			replRunning = false;
			rconn.close((err: any, msg: any) : any => {
				sideChannelSocket = null;
				sideChannel.close();
				console.log("Connection closed)");
			});
		});

		// sock.on('eval', (action) => {
		// 	switch (action) {
		// 	case 'terminate-and-exit':
		// 		replRunning = false;
		// 		sideChannelSocket = null;
		// 		sideChannel.close();
		// 		// terminate the process for the JVM
		// 		rconn.pid((err: any, result: any): void => {
		// 			// TODO this seems to never be reached
		// 			const pid = result[0]["pid"];
		// 			//exec("kill -9 " + pid);
		// 			process.kill(pid, "SIGKILL");
		// 			rconn.close((err: any, msg: any) : any => {
		// 				console.log("Connection closed)");
		// 			});
		// 		});

		// 		break;

		// 	case 'exit':
		// 		replRunning = false;
		// 		rconn.close((err: any, msg: any) : any => {
		// 			sideChannelSocket = null;
		// 			sideChannel.close();
		// 			console.log("Connection closed)");
		// 		});

		// 		break;

		// 	case 'load-namespace':
		// 		let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
		// 		rconn.eval("(require '" + ns + ")", (err: any, result: any) => {
		// 			sock.emit('load-namespace-result')
		// 		});
		// 		break;

		// 	default: console.error("Unknown side channel request");
		// 	}
		// });

		sock.emit('go-eval', {});
	});
}

// read the launch.json file to get relevant info
function parseLaunchJson() {
	let launchJson = null;

	let launchJsonPath = join(workspace.rootPath, ".vscode", "launch.json");
	if (existsSync(launchJsonPath)) {
		let launchJsonStr = readFileSync(launchJsonPath).toString();
		launchJson = JSON.parse(stripJsonComments(launchJsonStr));
	}

	return launchJson;
}

// Set up actions that work without the REPL
function setUpActions(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('clojure.expand_selection', () => {
		EditorUtils.selectBrackets(activeEditor);
	}));
	context.subscriptions.push(commands.registerCommand('clojure.debug', () => {
		// if launch.json exists and there are available configurations then offer a menu of choices to the user
		let launchJson = parseLaunchJson();
		if (launchJson) {

			const configNames = launchJson["configurations"].map((config: any) => {
				return config["name"];
			});

			if (!configNames || configNames.length < 1) {
					window.showErrorMessage("Please add at least one configuration to launch.json before launching the debugger.");
			} else {
				const options = {placeHolder: "Choose a launch profile"};
				window.showQuickPick(configNames, options).then((res)=> {
					if (res) {
						let configName = res;
						let index = configNames.indexOf(configName);
						let sideChannelPort: number = launchJson["configurations"][index]["sideChannelPort"];

						let refresh = launchJson["configurations"][index]["refreshOnLaunch"];
						if (refresh == false) {
							refreshOnLaunch = false;
						} else {
							refreshOnLaunch = true;
						}
						initSideChannel(context, sideChannelPort);
						window.setStatusBarMessage("Starting deugger");
						commands.executeCommand('vscode.startDebug', configName);
					}
				});
			}
		} else {
			window.showErrorMessage("Please create a launch.json file and add at least one configuration before launching the debugger.");
		}

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
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before evaluating code.");
		} else {
			// only support evaluating selected text for now.
			// See https://github.com/indiejames/vscode-clojure-debug/issues/39.
			window.setStatusBarMessage("$(pulse) Evaluating Code")
			let editor = window.activeTextEditor;
			let selection = editor.selection;
			let range = new Range(selection.start, selection.end);
			let code = editor.document.getText(range);
			lastEvalExp = code;
			let ns = EditorUtils.findNSForCurrentEditor(activeEditor);
			if (ns) {
				lastEvalNS = ns;
				rconn.eval(code, (err: any, result: any) : void => {
					handleEvalResponse(result);
				}, ns);
			} else {
				lastEvalNS = "";
				rconn.eval(code, (err: any, result: any) : void => {
					handleEvalResponse(result);
				});
			}
		}
	}));

	activeReplActions.push(commands.registerCommand('clojure.setExceptionBreakpointClass', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before setting breakpionts.");
		} else {
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
			});
		}
	}));

 activeReplActions.push(commands.registerCommand('clojure.load-file', () => {
	 if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before loading code.");
		} else {
		const path = EditorUtils.getFilePath(activeEditor);
		rconn.loadFile(path, (err: any, result: any) : void => {
				// TODO handle errors here
				// reapply the breakpoints since they will have been invalidated on any reloaded code
				const com = commands.executeCommand("workbench.debug.viewlet.action.reapplyBreakpointsAction");
				com.then(value => {
					console.log(value);
					console.log("Loaded Clojure code.");
				}, rejected => {
					console.error(rejected);
				});
			});
		}
 }));

	activeReplActions.push(commands.registerCommand('clojure.refresh', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before refreshing code.");
		} else {
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
		}
	}));

	activeReplActions.push(commands.registerCommand('clojure.superRefresh', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL refreshing code.");
		} else {
			rconn.superRefresh((err: any, result: any) : void => {
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
		}
	}));

	// TODO create a test runner class and move these to it
	activeReplActions.push(commands.registerCommand('clojure.run-all-tests', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before running tests.");
		} else {
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
		}
	}));

	activeReplActions.push(commands.registerCommand('clojure.run-test-file', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before running tests.");
		} else {
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
		}
	}));

	activeReplActions.push(commands.registerCommand('clojure.run-test', () => {
		if (!replRunning) {
			window.showErrorMessage("Please launch or attach to a REPL before running tests.");
		} else {
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
		}
	}));

	context.subscriptions.concat(activeReplActions);

}

// Create a connection to the debugged process and run some init code
function connect(context: ExtensionContext, reqId: number, sock:SocketIO.Socket, host: string, port: number) {
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
						// if (!replActionsEnabled) {
						// 	setUpReplActions(context, rconn);
						// 	replActionsEnabled = true;
						// }

						replRunning = true;

						sock.emit("connect-to-repl-complete", {id: reqId});

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

	languages.setLanguageConfiguration("clojure", languageConfiguration);

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



  // Create the connection object but don't connect yet
	rconn = new ReplConnection();

	setUpActions(context);
	setUpReplActions(context, rconn);

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