/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

///<reference path="node.d.ts"/>
/// <reference path="tmp/index.d.ts" />

import {DebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent, Thread, StackFrame, Scope, Source, Handles} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync, copySync, writeFileSync} from 'fs-extra';
// import {blue} from 'chalk';
import {basename, dirname, join} from 'path';
import {spawn} from 'child_process';
import nrepl_client = require('jg-nrepl-client');
import s = require('socket.io-client');
import tmp = require('tmp');
import {ReplConnection} from './replConnection';
let chalk = require("chalk");

let EXIT_CMD = "(System/exit 0)";

let projectClj = `(defproject repl_connect "0.1.0-SNAPSHOT"
  :description "Embedded project for Debug REPL."
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :profiles {:dev {:dependencies [[debug-middleware "0.1.1-SNAPSHOT"]]
                   :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}}}
  :resource-paths []
  :dependencies [[org.clojure/clojure "1.8.0"]
                 [debug-middleware "0.1.1-SNAPSHOT"]
                 [cdt "1.2.6.3"]])`;

// Constants to represent the various states of the debugger
class DebuggerState {
	public static get PRE_LAUNCH(): string { return "PRE_LAUNCH"; }
	public static get REPL_STARTED(): string { return "REPL_STARTED"; }
	public static get DEBUGGER_ATTACHED(): string { return "DEBUGGER_ATTACHED"; }
	public static get REPL_READY(): string { return "REPL_READY"; }
	public static get LAUNCH_COMPLETE(): string { return "LAUNCH_COMPLETE"; }
}

class DebuggerSubState {
	public static get NOP(): string { return "NOP"; }
	public static get EVENT_IN_PROGRESS(): string { return "EVENT_IN_PROGRESS"; }
}


/**
 * This interface should always match the schema found in the clojure-debug extension manifest.
 */
export interface LaunchRequestArguments {
	// Absolute path to the tool.jar file.
	toolsJar: string;
	// Host for the debugged REPL
	// replHost: string;
	// Port for the debugged REPL
	replPort: number;
	// Port for debugger REPL
	debugReplPort: number;
	// Port for JDWP connection
	debugPort: number;
	// Port for side channel
	sideChannelPort: number;
	// Path to lein
	leinPath: string,
	// Current working directory
	cwd: string;
	// The environment variables that should be set when running the target.
	env: string[];
	// Automatically stop target after launch. If not specified, target does not stop.
	stopOnEntry?: boolean;
	// Refresh namespaces on launch. Defaults to true.
	refreshOnLaunch?: boolean;

}

// utility funciton to

class ClojureDebugSession extends DebugSession {

	private _sourceFile: string;
	private _sourceLines: string[];
	private _breakPoints: any;
	// private _variableHandles: Handles<string>;
	private _variableHandles: Handles<any[]>;
	private _replConnection: ReplConnection;
	private _isLaunched: boolean;
	// Debugger state
	private _debuggerState: DebuggerState;
	// Debugger substate
	private _debuggerSubState: DebuggerSubState;
	// map of sessions ids to evalulation results
	private _evalResults: any;
	// list of stack frames for the current thread
	private _frames: StackFrame[];
	// configuration
	private configuration: any;
	// debugger side channel port
	private _sideChannelPort: number;
	// path to project.clj for debugger REPL
	private _tmpProjectDir: string;

	// Get the full path to a source file. Input paths are of the form repl_test/core.clj.
	// TODO Change this to search for the given debuggerPath under all the src directories.
	// For now assume all source is under src.
	protected convertDebuggerPathToClient(debuggerPath: string): string {
		return join(this._cwd, "src", debuggerPath);
	}

	// just use the first thread as the default thread
	private static THREAD_ID = 0;

	// the current working directory
	private _cwd: string;

	// directory where this extension is stored
	private _extensionDir: string;

	// Clojure REPL process
	private _debuggerRepl: any;
	private _primaryRepl: any;

	private __currentLine: number;
	private get _currentLine(): number {
		return this.__currentLine;
	}

	private set _currentLine(line: number) {
		this.__currentLine = line;
		this.sendEvent(new OutputEvent(`line: ${line}\n`));	// print current line on debug console
	}

	private __threadIndex: number = 0;
	private __threads: Thread[] = [];
	// update the list of Threads with the given list of thread names
	private updateThreads(thds: string[]) {
		// add in new threads
		for (var t of thds) {
			// TypeScript arrays don't have a `find` method
			var index = -1;
			for (var i = 0; i < this.__threads.length; i++) {
				const thread = this.__threads[i];
				if (thread.name == t) {
					index = i;
					break;
				}
			}
			if (index == -1) {
				var newThread = new Thread(this.__threadIndex, t);
				this.__threadIndex = this.__threadIndex + 1;
				this.__threads.push(newThread);
			}
		}

		// remove threads that aren't on the new list
		this.__threads = this.__threads.filter((value: Thread) => {
			if (thds.indexOf(value.name) != -1) {
				return true;
			} else {
				return false;
			}
		});
	}

	// Returns the Thread with the given name.
	private threadWithName(name: string): Thread {
		// TypeScript arrays don't have a `find` method
		var index = -1;
		for (var i = 0; i < this.__threads.length; i++) {
			const thread = this.__threads[i];
			if (thread.name == name) {
				index = i;
				break;
			}
		}
		var rval = null;
		if (index != -1) {
			rval = this.__threads[index];
		}

		return rval;
	}

	// Returns the Thread with the given id
	private threadWithID(id: number): Thread {
		var rval: Thread = null;

		for (var i = 0; i < this.__threads.length; i++) {
			const t = this.__threads[i];
			if (t.id == id) {
				rval = t;
				break;
			}
		}

		return rval;
	}

	public constructor(_debuggerLinesStartAt1: boolean = true, isServer: boolean = false) {
		// We always use debuggerLinesStartAt1 = true for Clojure
		super(true, isServer);
		this._sourceFile = null;
		this._sourceLines = [];
		this._currentLine = 0;
		this._isLaunched = false;
		this._breakPoints = {};
		this._variableHandles = new Handles<any[]>();
		this._debuggerState = DebuggerState.PRE_LAUNCH;
		this._debuggerSubState = DebuggerSubState.NOP;
		this._evalResults = {};
		this._frames = [];
	}

	// send data form the REPL's stdout to be displayed in the debugger
	protected output(text, category) {
		var outputEvent = new OutputEvent(text, category);
		this.sendEvent(outputEvent);
		console.log(text);
	}

	protected pout(text) {
		this.output(chalk.magenta(text), "stdout");
	}

	protected perr(text) {
		this.output(text, "stderr");
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		console.log("INITIALIZE REQUEST");

		//this.configuration = workspace.getConfiguration("clojure-debug");

		// announce that we are ready to accept breakpoints -> fire the initialized event to give UI a chance to set breakpoints
		this.sendEvent(new InitializedEvent());

		response.body.supportsConfigurationDoneRequest = true;

		// We want to have VS Code call evaulate when hovering over source (yet. if there is a way to expand to a full
		// form then we will want to do this.)
		response.body.supportsEvaluateForHovers = false;

		// SOME DAY!!!
		response.body.supportsFunctionBreakpoints = false;

		this.sendResponse(response);
		//super.initializeRequest(response, args);
	}

	// Handle events from the REPL (breakpoints, exceptions). We make a single request here to get an event,
	// which effectivley creates a channel that the middleware can send event info back to us on.
	// TODO - test to see if there is a timeout issue here since we will be listening on the socket waiting
	// for a response until an event happens.
	private handleEvent(err: any, result: any) {
		if (result != null) {
			let event = result[0]["event"];
			var eventMap = JSON.parse(event);
			var threadName = eventMap["thread"];
			let eventType = eventMap["event-type"];
			const thread = this.threadWithName(threadName);
			var threadId = -1;

			if (thread == null) {
				threadId = this.__threadIndex;
				this.__threads.push(new Thread(threadId, threadName));
				this.__threadIndex = this.__threadIndex + 1;
			} else {
				threadId = thread.id;
			}

			switch (eventType) {
				case "breakpoint":
					var src = eventMap["src"];
					var line = eventMap["line"];
					this._currentLine = line;
					console.log("Sending breakpoint event to debugger for thread " + threadId);
					this.sendEvent(new StoppedEvent("breakpoint", threadId));
					break;

				case "exception":
					this.sendEvent(new StoppedEvent("exception", threadId));
					break;

				default:

			}
		}

		// start listening for events again
		let debug = this;
		this._replConnection.getEvent((err: any, result: any) => {
			// TODO handle errors here
			if (err) {
				console.error(err);
			} else {
				debug.handleEvent(err, result);
			}
		});
	}

	// Handle output from the REPL after launch is complete
	protected handleReplOutput(output) {

		if ((this._debuggerState == DebuggerState.REPL_STARTED) && (output.search(/Attached to process/) != -1)) {
			this._debuggerState = DebuggerState.DEBUGGER_ATTACHED;
			console.log("DEBUGGER_ATTACHED");
		}

		if (this._debuggerSubState == DebuggerSubState.EVENT_IN_PROGRESS) {
			this._debuggerSubState = DebuggerSubState.NOP;

			var eventMap = JSON.parse(output);
			var event = eventMap["event"];
			var threadName = eventMap["thread"];
			const thread = this.threadWithName(threadName);
			var threadId = -1;

			if (thread == null) {
				threadId = this.__threadIndex;
				this.__threads.push(new Thread(threadId, threadName));
				this.__threadIndex = this.__threadIndex + 1;
			}

			if (event == "breakpoint") {
				var src = eventMap["src"];
				var line = eventMap["line"];
				this._currentLine = line;
				this.sendEvent(new StoppedEvent("breakpoint", threadId));
			}

		}
		if (output.search(/CDB MIDDLEWARE EVENT/) != -1) {
			this._debuggerSubState = DebuggerSubState.EVENT_IN_PROGRESS;
		}
	}

	private connectToDebugREPL(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments, repl_port: number, debugged_port: number) {
		this._debuggerRepl.stdout.on('data', (data) => {
			var output = '' + data;

			let self = this;

      if ((output.search(/nREPL server started/) != -1)) {
				self._debuggerState = DebuggerState.REPL_READY;
				self._replConnection = new ReplConnection();
				self._replConnection.connect("127.0.0.1", repl_port, (err: any, result: any) => {
					if (err) {
						console.log(err);
					}
				});

				console.log("CONNECTED TO REPL");

				self._debuggerState = DebuggerState.LAUNCH_COMPLETE;

				self._replConnection.attach(debugged_port, (err: any, result: any) => {
					console.log("Debug REPL attached to Debugged REPL");

					// start listening for events
					self.handleEvent(null, null);

					// if (args.refreshOnLaunch) {

					// } else {
					// 	self._replConnection.listThreads((err: any, result: any) => {
					// 		console.log(result);
					// 		self.updateThreads(result[0]["threads"]);

					// 		console.log("Got threads");

					// 	});
					// }


					if (args.stopOnEntry) {
						self._currentLine = 1;
						self.sendResponse(response);

						// we stop on the first line - TODO need to figure out what thread this would be and if we even want to support this
						self.sendEvent(new StoppedEvent("entry", ClojureDebugSession.THREAD_ID));
					} else {
						// we just start to run until we hit a breakpoint or an exception
						response.body = {
							/** If true, the continue request has ignored the specified thread and continued all threads instead. If this attribute is missing a value of 'true' is assumed for backward compatibility. */
							allThreadsContinued: true
						};
						// DO I need this?
						self.sendResponse(response);

						self.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: ClojureDebugSession.THREAD_ID });
					}
				});

			}

			self.handleReplOutput(output);

			// self.pout(output);

		});

		this._debuggerRepl.stderr.on('data', (data) => {
			this.perr(data);
			console.log(`stderr: ${data}`);
		});
	}

	private setupDebugREPL(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments){
		let self = this;

		let env = {"HOME": process.env["HOME"]};

		var debugReplPort = 5556;
		if (args.debugReplPort) {
			debugReplPort = args.debugReplPort;
		}

		let debugPort = 3030;
		if (args.debugPort) {
			debugPort = args.debugPort;
		}

		var lein_path = "/usr/local/bin/lein";
		if (args.leinPath) {
			lein_path = args.leinPath;
		}

		self._debuggerRepl = spawn(lein_path, ["update-in", ":resource-paths", "conj", "\"" + args.toolsJar + "\"", "--", "repl", ":headless", ":port", "" + debugReplPort], {cwd: this._tmpProjectDir, env: env });
		self._debuggerState = DebuggerState.REPL_STARTED;
		console.log("DEBUGGER REPL STARTED");
		// TODO remove this magic number
		self.connectToDebugREPL(response, args, debugReplPort, debugPort);

	}

	private createDebuggerProject() {
		// create a tempory lein proejct
		var tmpobj = tmp.dirSync({ mode: 0o750, prefix: 'repl_connnect_' });
		this._tmpProjectDir = tmpobj.name;
		let projectPath = join(tmpobj.name, "project.clj");
		console.log("PROJECT.CLJ FILE: ", projectPath);
		writeFileSync(projectPath, projectClj);
	}

	protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments) {
		console.log("ATTACH REQUEST");
		this.createDebuggerProject();

	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		console.log("LAUNCH REQUEST");
		this._isLaunched = true;
		let self = this;

		this.createDebuggerProject();

		this._cwd = args.cwd;
		console.log("CWD: " + this._cwd);

		var replPort = 5555;
		if (args.replPort) {
			replPort = args.replPort;
		}

		var debugPort = 8030;
		if (args.debugPort) {
			debugPort = args.debugPort;
		}

		this._sideChannelPort = 3030;
		if (args.sideChannelPort) {
			this._sideChannelPort = args.sideChannelPort;
		}

		var lein_path = "/usr/local/bin/lein";
		if (args.leinPath) {
			lein_path = args.leinPath;
		}

		var env = {
			"HOME": process.env["HOME"], "JVM_OPTS": "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=" + debugPort,
			"CLOJURE_DEBUG_JDWP_PORT": "" + debugPort
		};

		this._primaryRepl = spawn(lein_path, ["with-profile", "+debug-repl", "repl", ":headless", ":port", "" + replPort], { cwd: this._cwd, env: env });

		this._primaryRepl.stdout.on('data', (data) => {
			var output = '' + data;
			console.log(output);

			if ((output.search(/nREPL server started/) != -1)) {
				console.log("PRIMARY REPL STARTED");
				this.setupDebugREPL(response, args);
				let sideChannel = s("http://localhost:" + self._sideChannelPort);

				sideChannel.on('go-eval', (data) => {
					sideChannel.emit("connect-to-repl", "127.0.0.1:" + replPort);
					sideChannel.close();
				});
			}
		});

		this._primaryRepl.stderr.on('data', (data) => {
			self.perr(data);
			console.log(`stderr: ${data}`);
		});

		this._primaryRepl.on('close', (code) => {
			if (code !== 0) {
				console.log(`REPL process exited with code ${code}`);
			}
			console.log("REPL closed");
		});
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		console.log("Diconnect requested");

		this._replConnection.eval(EXIT_CMD, (err: any, result: any): void => {
			// This is never called, apparently.
		});

		this._replConnection.close((err: any, result: any): void => {
			// do nothing
		});

		var self = this;
		let sideChannel = s("http://localhost:" + self._sideChannelPort);

		sideChannel.on('go-eval', (data) => {
			if (this._isLaunched) {
				sideChannel.emit("eval","terminate-and-exit");
			} else {
				sideChannel.emit("eval","exit");
			}

			self.sendResponse(response);
			self.shutdown();
		});
	}

	protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): void {
		console.log("Source request");

	}

	// TODO Fix the check for successful breakpoints and return the correct list
	protected finishBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, fileContents: Buffer, path: string): void {
		console.log("FINISH BREAKPOINTS REQUEST");
		var clientLines = args.lines;

		// read file contents into array for direct access
		var lines = fileContents.toString().split('\n');

		var newPositions = [clientLines.length];
		var breakpoints = [];

		// verify breakpoint locations
		// TODO fix this
		for (var i = 0; i < clientLines.length; i++) {
			var l = this.convertClientLineToDebugger(clientLines[i]);
			this._replConnection.setBreakpoint(path, l, (err: any, result: any) => {
				console.log(result);
			});

			var verified = false;
			if (l < lines.length) {
				// if a line starts with '+' we don't allow to set a breakpoint but move the breakpoint down
				if (lines[l].indexOf("+") == 0)
					l++;
				// if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
				if (lines[l].indexOf("-") == 0)
					l--;
				verified = true;    // this breakpoint has been validated
			}
			newPositions[i] = l;
			breakpoints.push({ verified: verified, line: this.convertDebuggerLineToClient(l) });
		}
		this._breakPoints[path] = newPositions;

		// send back the actual breakpoints
		response.body = {
			breakpoints: breakpoints
		};
		this.sendResponse(response);

	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		console.log("Set breakpoint requested");

		var path = args.source.path;
		var self = this;

		this._replConnection.clearBreakpoints(path, (err: any, result: any) => {
			if (err) {
				// TODO figure out what to do here
				console.error(err);
			} else {
				var fileContents = readFileSync(path);
				var regex = /\(ns\s+?(.*?)(\s|\))/;
				var ns = regex.exec(fileContents.toString())[1];

				// Load the associated namespace into the REPL.
				// We have to use the extension connection to load the namespace
				// We must wait for the response before replying with the SetBreakpointResponse.
				let sideChannel = s("http://localhost:" + self._sideChannelPort);
				sideChannel.on('go-eval', (data) => {
					sideChannel.on('load-namespace-result', (data) => {
						self.finishBreakPointsRequest(response, args, fileContents, path)
					});
					sideChannel.emit("eval", "load-namespace");

				});
			}


			// 	//console.log(result);
			// });

		});

		// TODO reject breakpoint requests outside of a namespace

	}

	protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
		var type = "none";
		if (args.filters.indexOf("uncaught") != -1) {
			type = "uncaught";
		}
		if (args.filters.indexOf("all") != -1) {
			type = "all";
		}
		this._replConnection.setExceptionBreakpoint(type, (err: any, result: any) => {
			if (err) {
				response.success = false;
			} else {
				response.success = true;
			}
			this.sendResponse(response);
		});
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		console.log("GETTING THREADS");
		const debug = this;
		this._replConnection.listThreads((err: any, result: any) => {
			console.log(result);
			debug.updateThreads(result[0]["threads"]);

			console.log("Sending threads to debugger:\n");
			for (let i = 0; i < debug.__threads.length; i++) {
				let th = debug.__threads[i];
				console.log("id: " + th.id + " name: " + th.name);
			}

			response.body = {
				threads: debug.__threads
			};

			debug.sendResponse(response);
		});

	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		console.log("STACK FRAME REQUEST");
		const levels = args.levels;
		const threadId = args.threadId;
		console.log("LEVELS: " + levels);
		console.log("THREAD_ID: " + threadId);
		const th = this.threadWithID(threadId)
		const debug = this;
		this._replConnection.listFrames(th.name, (err: any, result: any) => {
			console.log(result);
			var resFrames = result[0]["frames"];
			console.log(resFrames);
			const frames: StackFrame[] = resFrames.map((frame: any, index: number): StackFrame => {
				var f = new StackFrame(index, `${frame["srcName"]}(${index})`, new Source(frame["srcName"], debug.convertDebuggerPathToClient(frame["srcPath"])), debug.convertDebuggerLineToClient(frame["line"]), 0);
				f["threadName"] = th.name;
				return f;
			});

			debug._frames = frames;

			response.body = {
				stackFrames: frames
			};
			debug.sendResponse(response);
		});
	}

	private storeValue(name: string, val: any): any {
		if (val._keys) {
			let vals = val._keys.map((key: any) : any => {
				return this.storeValue(key, val[key]);
			});
			let ref = this._variableHandles.create(vals);
			return {name: name, value: "" + val, variablesReference: ref};
		} else if (val instanceof Array) {
			var index = 0;
			let vals = val.map((v: any) : any => {
				return this.storeValue("" + index++, v);
			});

			let ref = this._variableHandles.create(vals);
			return {name: name, value: "" + val, variablesReference: ref};
		} else {
			return {name: name, value: "" + val, variablesReference: 0};
		}
	}

	// For non-primitve, non-array types stores a hierachical reference that can be used
	// to aid value inspection and returns a refrerence. For primitive types and arrays it returns 0.
	private storeValueB(name: string, val: any): any {
		if (val._keys) {
			// TODO try just returning a hard coded map like the ones from the mock debugger to see if it works
			let ids =  val._keys.map((key: any) : any => {
				let v = val[key];
				return this.storeValue(key, v);
			});

			// return {
			// 	name: name + "_o",
			// 	type: "object",
			// 	value: "Object",
			// 	variablesReference: this._variableHandles.create(["object_"])
			// }
			return this._variableHandles.create([{name: name, value: "" + val, variablesReference: ids}]);
		} else {
			return this._variableHandles.create([{name: name, value: "" + val, variablesReference: 0}]);
		}
	}

	// TODO Write a function to take a complex variable and convert it to a nested structure (possibly with sub variable references)
	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		console.log("SCOPES REQUEST");
		const frameReference = args.frameId;
		const frame = this._frames[frameReference];
		const threadName = frame["threadName"];
		const debug = this;

		// get the variables for the given stack frame
		this._replConnection.listVars(threadName, frame.id, (err: any, result: any) => {
			console.log("GOT VARIABLES");
			console.log(result);
			var variables = result[0]["vars"];
			console.log("VARS: " + variables);
			var frameArgs = variables[0];
			var frameLocals = variables[1];
			var argScope = frameArgs.map((v: any): any => {
				let val = debug.storeValue(v["name"], v["value"]);
				// let val = this._variableHandles.get(varId)[0];
				//let val = { name: v["name"], value: "" + v["value"], variablesReference: };
				return val;
			});
			var localScope = frameLocals.map((v: any): any => {
				// let val = { name: v["name"], value: "" + v["value"], variablesReference: 0 };
				//let val = { name: v["name"], value: {a: "A", b: [{c: "C"}, {d: "D"}]}, variablesReference: 0};
				// let val = { name: v["name"], value: "" + v["value"], variablesReference: this._variableHandles.create(v["value"])};
				// let val = {name: v["name"], value: "" + v["value"], variablesRefrence: this.storeValue(v["name"], v["value"])};
				// return val;
				// return this.storeValue(v["name"], v["value"]);
				let val = debug.storeValue(v["name"], v["value"]);
				// let val = this._variableHandles.get(varId)[0];
				return val;
			});
			const scopes = new Array<Scope>();
			scopes.push(new Scope("Local", debug._variableHandles.create(localScope), false));
			scopes.push(new Scope("Argument", debug._variableHandles.create(argScope), false));
			// scopes.push(new Scope("Global", this._variableHandles.create("global_" + frameReference), true));

			response.body = {
				scopes: scopes
			};
			debug.sendResponse(response);
		});
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		console.log("VARIABLES REQUEST");
		var variables = [];

		const vars = this._variableHandles.get(args.variablesReference);
		if (vars != null) {
			variables = vars;
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

// protected scopesRequestB(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

// 		const frameReference = args.frameId;
// 		const scopes = new Array<Scope>();
// 		scopes.push(new Scope("Local", this._variableHandles.create(["local_" + frameReference]), false));
// 		scopes.push(new Scope("Closure", this._variableHandles.create(["closure_" + frameReference]), false));
// 		scopes.push(new Scope("Global", this._variableHandles.create(["global_" + frameReference]), true));

// 		response.body = {
// 			scopes: scopes
// 		};
// 		this.sendResponse(response);
// 	}

// 	protected variablesRequestB(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {

// 		const variables = [];
// 		const id = this._variableHandles.get(args.variablesReference);
// 		if (id != null) {
// 			variables.push({
// 				name: id + "_i",
// 				type: "integer",
// 				value: "123",
// 				variablesReference: 0
// 			});
// 			variables.push({
// 				name: id + "_f",
// 				type: "float",
// 				value: "3.14",
// 				variablesReference: 0
// 			});
// 			variables.push({
// 				name: id + "_s",
// 				type: "string",
// 				value: "hello world",
// 				variablesReference: 0
// 			});
// 			variables.push({
// 				name: id + "_o",
// 				type: "object",
// 				value: "Object",
// 				variablesReference: this._variableHandles.create(["object_"])
// 			});
// 		}

// 		response.body = {
// 			variables: variables
// 		};
// 		this.sendResponse(response);
// 	}


	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		console.log("CONTINUE REQUEST");
		const debug = this;
		this._replConnection.continue((err: any, result: any) => {
			// TODO handle errors here
			debug.sendResponse(response);
			console.log(result);
		});
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		console.log("CONTINUE REQUEST");

		for (let ln = this._currentLine + 1; ln < this._sourceLines.length; ln++) {
			if (this._sourceLines[ln].trim().length > 0) {   // find next non-empty line
				this._currentLine = ln;
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("step", ClojureDebugSession.THREAD_ID));
				return;
			}
		}
		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	private isErrorStatus(status: Array<string>): boolean {
		return (status.indexOf("error") != -1)
	}

	private getErrorMessage(status: Array<string>): string {
		for (var msg of status) {
			if (msg != "done" && msg != "error") {
				return msg;
			}
		}

		return "UNKNOWN ERROR";
	}

	// Handle the result from an eval NOT at a breakpoint
	private handleResult(response: DebugProtocol.EvaluateResponse, replResult: any): void {
		// forward stdout from the REPL to the debugger
		var out = replResult["out"];
		if (out && out != "") {
			this.pout(out);
		}

		// forwared stderr from the REPL to the debugger
		var err = replResult["err"];
		if (err && err != "") {
			this.perr(err);
		}

		var session = replResult["session"];
		var result = this._evalResults[session] || {};
		let status = replResult["status"];
		if (status) {
			if (this.isErrorStatus(status)) {
				let errorMessage = this.getErrorMessage(status);
				response.success = false;
				response.message = errorMessage;
				this.sendResponse(response);
				this._evalResults[session] = null;
			} else if(replResult["status"][0] == "done") {
				response.body = {
					result: result["value"],
					// TODO implement this for complex results
					variablesReference: 0
				}

				var err = result["error"];
				if (err && err != "") {
					response.success = false;
					response.message = err;
				}

				this.sendResponse(response);
				this._evalResults[session] = null;

			} else if (status[0] == "eval-error") {
				var ex = replResult["ex"];
				if (ex && ex != "") {
					var err = result["error"] || "";
					result["error"] = err + "\n" + ex;
					response.success = false;
					response.message = ex;
					this.sendResponse(response);
					this._evalResults[session] = null;
				}
			}
		} else {

			if (replResult["value"]) {
				var value = result["value"] || "";
				result["value"] = value + replResult["value"];
			}

			this._evalResults[session] = result;
		}
	}

	private handleFrameResult(response: DebugProtocol.EvaluateResponse, replResult: any): void {
		// forward stdout form the REPL to the debugger
		var out = replResult["out"];
		if (out && out != "") {
			this.pout(out);
		}

		// forwared stderr from the REPL to the debugger
		var err = replResult["err"];
		if (err && err != "") {
			this.perr(err);
		}

		var session = replResult["session"];
		// var result = this._evalResults[session] || {};
		var result = replResult["value"];
		if (replResult["status"] && replResult["status"][0] == "done") {
			response.body = {
				// result: result["value"],
				result: result,
				// TODO implement this for complex results
				variablesReference: 0
			}

			var err = result["error"];
			if (err && err != "") {
				response.success = false;
				response.message = err;
			}

			this.sendResponse(response);
			this._evalResults[session] = null;

		} else {

			if (replResult["value"]) {
				var value = result["value"] || "";
				result["value"] = value + replResult["value"];
			}
			var ex = replResult["ex"];
			if (ex && ex != "") {
				var err = result["error"] || "";
				result["error"] = err + "\n" + ex;
			}
			this._evalResults[session] = result;
		}
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		var expr = args.expression;
		var self = this;
		var ns = 'user';

		if (args.context == 'repl') {
			if (args.frameId != null) {
				console.log("FRAME EVAL REQUESTED");
				// evaluate in the context of the given thread/frame
				this._replConnection.reval(args.frameId, expr, (err: any, result: any) => {
					for (var res of result) {
						self.handleFrameResult(response, res);
					}
				});

			} else {
				// get context for eval from extension
				console.log("EVAL REQUESTED");
				let sideChannel = s("http://localhost:" + self._sideChannelPort);
				sideChannel.on('go-eval', (data) => {

					sideChannel.on('eval-code-result', (result) => {
						for (var res of result) {
							self.handleResult(response, res);
						}
						sideChannel.close();
					});
					sideChannel.emit('eval-code', expr);
				});
		  	}
		}
	}
}

DebugSession.run(ClojureDebugSession);
