/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

///<reference path="node.d.ts"/>
/// <reference path="tmp/index.d.ts" />

import {DebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent, Thread, StackFrame, Scope, Source, Handles} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync, copySync} from 'fs-extra';
// import {blue} from 'chalk';
import {basename, dirname, join} from 'path';
import {spawn} from 'child_process';
import nrepl_client = require('jg-nrepl-client');
import s = require('socket.io-client');
import tmp = require('tmp');
import {ReplConnection} from './replConnection';
let chalk = require("chalk");

let EXIT_CMD = "(System/exit 0)";

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
	// Port for nREPL
	replPort: number;
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
	private _cdtRepl: any;
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

			if (eventType == "breakpoint") {
				var src = eventMap["src"];
				var line = eventMap["line"];
				this._currentLine = line;
				console.log("Sending breakpoint event to debugger for thread " + threadId);
				this.sendEvent(new StoppedEvent("breakpoint", threadId));
			}
		}

		// start listening for events again
		let debug = this;
		this._replConnection.getEvent((err: any, result: any) => {
			// TODO handle errors here
			console.log("GOT EVENT:");
			console.log(result);
			debug.handleEvent(err, result);
		});

	}

	// Handle output from the REPL after launch is complete
	protected handleREPLOutput(output) {

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

	private connectToCDTREPL(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments, repl_port: number, debugged_port: number) {
		this._cdtRepl.stdout.on('data', (data) => {
			var output = '' + data;

			let self = this;

			// if ((self._debuggerState == DebuggerState.DEBUGGER_ATTACHED) && (output.search(/nREPL server started/) != -1)) {
            if ((output.search(/nREPL server started/) != -1)) {
				self._debuggerState = DebuggerState.REPL_READY;
				self._replConnection = new ReplConnection("127.0.0.1", repl_port);

				console.log("CONNECTED TO REPL");

				self._debuggerState = DebuggerState.LAUNCH_COMPLETE;

				var sideChannel = s("http://localhost:" + self._sideChannelPort);
				sideChannel.on('go-eval', (data) => {
					sideChannel.emit("eval", "attach");
					sideChannel.close();
				});

				self._replConnection.attach(debugged_port, (err: any, result: any) => {
					console.log("Debug REPL attached to Debugged REPL");

					// start listening for events
					self.handleEvent(null, null);

					if (args.refreshOnLaunch) {
						self._replConnection.refresh((err: any, result: any) => {
							self._replConnection.listThreads((err: any, result: any) => {
								console.log(result);
								self.updateThreads(result[0]["threads"]);

								console.log("Got threads");

							});
						});
					} else {
						self._replConnection.listThreads((err: any, result: any) => {
							console.log(result);
							self.updateThreads(result[0]["threads"]);

							console.log("Got threads");

						});
					}


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
						// self.sendResponse(response);

						self.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: ClojureDebugSession.THREAD_ID });
					}
				});

			}

			self.handleREPLOutput(output);

			self.pout(output);

		});

		this._cdtRepl.stderr.on('data', (data) => {
			this.perr(data);
			console.log(`stderr: ${data}`);
		});
	}

	protected attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments) {
		console.log("ATTACH REQUEST");

	}

	private setupSideChannelAndDebugREPL(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments, repl_port: number, debug_port: number, lein_path: string){
		let self = this;
		let sideChannel = s("http://localhost:" + self._sideChannelPort);
		sideChannel.on('go-eval', (data) => {
			sideChannel.emit("eval", "get-extension-directory");
			sideChannel.on('get-extension-directory-result', (data) => {
				self._extensionDir = data;
				sideChannel.close();
				// launch debugger REPL
				let env = {"HOME": process.env["HOME"]};
				// create a tempory lein proejct
				var tmpobj = tmp.dirSync({ mode: 0o750, prefix: 'repl_connnect_' });
				console.log("PROJECT TMP DIR: ", tmpobj.name + "/project.clj");
				copySync(self._extensionDir + "/out/project.clj", tmpobj.name + "/project.clj")
				// Manual cleanup
				//tmpobj.removeCallback();

				// TODO remove this magic number (string)
				self._cdtRepl = spawn(lein_path, ["repl", ":headless", ":port", "7878"], {cwd: tmpobj.name, env: env });
				self._debuggerState = DebuggerState.REPL_STARTED;
				console.log("DEBUGGER REPL STARTED");
				// TODO remove this magic number
				self.connectToCDTREPL(response, args, 7878, debug_port);
			});
		});
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		console.log("LAUNCH REQUEST");
		this._isLaunched = true;
		let self = this;

		//var cwd = dirname(args.program);
		this._cwd = args.cwd;
		console.log("CWD: " + this._cwd);
		var repl_port = 5555;
		if (args.replPort) {
			repl_port = args.replPort;
		}

		var debug_port = 8030;
		if (args.debugPort) {
			debug_port = args.debugPort;
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
			"HOME": process.env["HOME"], "JVM_OPTS": "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=" + debug_port,
			"CLOJURE_DEBUG_JDWP_PORT": "" + debug_port
		};

		this._primaryRepl = spawn(lein_path, ["with-profile", "+debug-repl", "repl", ":headless", ":port", "" + repl_port], { cwd: this._cwd, env: env });

		this._primaryRepl.stdout.on('data', (data) => {
			var output = '' + data;
			console.log(output);

			if ((output.search(/nREPL server started/) != -1)) {
				console.log("PRIMARY REPL STARTED");
				this.setupSideChannelAndDebugREPL(response, args, 7878, debug_port, lein_path);
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
		var self = this;
		if (this._isLaunched) {
			this._replConnection.eval(EXIT_CMD, (err: any, result: any): void => {
				self._primaryRepl.kill('SIGKILL');
				self.sendResponse(response);
				self.shutdown();
			});
		} else {
			this._replConnection.close((err: any, result: any): void => {
				// do nothing
			});
		}

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
				let val = { name: v["name"], value: "" + v["value"], variablesReference: 0 };
				return val;
			});
			var localScope = frameLocals.map((v: any): any => {
				let val = { name: v["name"], value: "" + v["value"], variablesReference: 0 };
				return val;
			});
			const scopes = new Array<Scope>();
			scopes.push(new Scope("Local", this._variableHandles.create(localScope), false));
			scopes.push(new Scope("Argument", this._variableHandles.create(argScope), false));
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
		const id = this._variableHandles.get(args.variablesReference);
		if (id != null) {
			variables = id;
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

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
				let errorMessage = status[0];
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
