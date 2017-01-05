/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

///<reference path="node.d.ts"/>
/// <reference path="tmp/index.d.ts" />

import {DebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent, Thread, StackFrame, Scope, Source, Handles} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync, copySync, writeFileSync, mkdirSync, createReadStream} from 'fs-extra';
import {basename, dirname, join} from 'path';
import {spawn} from 'child_process';
import * as os from 'os';
import nrepl_client = require('jg-nrepl-client');
import s = require('socket.io-client');
import tmp = require('tmp');
import {ReplConnection} from './replConnection';
import {parse, toJS} from 'jsedn';
let chalk = require("chalk");
let fined = require("fined");
let core = require('core-js/library');

let EXIT_CMD = "(System/exit 0)";

let projectClj = `(defproject repl_connect "0.1.0-SNAPSHOT"
  :description "Embedded project for Debug REPL."
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :profiles {:dev {:dependencies [[debug-middleware "0.1.2-SNAPSHOT"]]
                   :repl-options {:nrepl-middleware [debug-middleware.core/debug-middleware]}}}
  :resource-paths []
  :dependencies [[org.clojure/clojure "1.8.0"]
                 [debug-middleware "0.1.2-SNAPSHOT"]])`;

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
 * Base class for LaunchRequestArguments and attachRequest
 */
export interface BaseRequestArguments {
	// Current working directory
	cwd: string;
	// Absolute path to the tool.jar file.
	toolsJar: string;
	// Port for the debugged REPL
	replPort: number;
	// Port for debugger REPL
	debugReplPort: number;
	// Port for JDWP connection
	debugPort: number;
	// Port for side channel
	sideChannelPort: number;
	// Path to lein
	leinPath: string;
	// not used - here to let this type act like a LaunchRequestArguments type
}

/**
 * This interface should always match the schema found in the clojure-debug extension manifest.
 */
export interface AttachRequestArguments extends BaseRequestArguments {
	// Host for the debugged REPL on attach requests
	replHost: string;
}

/**
 * This interface should always match the schema found in the clojure-debug extension manifest.
 */
export interface LaunchRequestArguments extends BaseRequestArguments {
	// Console type for launch requests
	console: string;
	// The command to run with arguments
	commandLine: string[];
	// The environment variables that should be set when running the target.
	env: {};
	// Refresh namespaces on launch. Defaults to true.
	refreshOnLaunch?: boolean;
}

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
	// side channel socket
	private sideChannel: any;
	// path to project.clj for debugger REPL
	private _tmpProjectDir: string;
	// whether or not the client support running in a terminal
	private supportRunInTerminal: boolean;
	// map of side channel request ids to debug request data
	private requestData: any = {};
	// side channel request id seqeunce
	private requestId = 0;

	// get and increment the requestId for side channel requests
	private getNextRequestId(): number {
		const rval = this.requestId;
		this.requestId = this.requestId + 1;
		return rval;
	}

	// Get the full path to a source file. Input paths are of the form repl_test/core.clj.
	// This is only used at breakpoints, so we use the stored breakpoints to determine
	// what the original full path was.
	protected convertDebuggerPathToClientPath(debuggerPath: string, line: number): string {
		let rval = "";
		if (debuggerPath.substr(0, 1) == "/") {
			rval = debuggerPath;
		} else {
			// TODO this is inefficient - should stop on match
			for (let path in this._breakPoints) {
				const lines = this._breakPoints[path];
				if(core.String.endsWith(path, debuggerPath) && lines.includes(line)) {
					rval = path;
					break;
				}
			}

			return rval;
		}
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
		for (let t of thds) {
			// TypeScript arrays don't have a `find` method
			let index = -1;
			for (let i = 0; i < this.__threads.length; i++) {
				const thread = this.__threads[i];
				if (thread.name == t) {
					index = i;
					break;
				}
			}
			if (index == -1) {
				const newThread = new Thread(this.__threadIndex, t);
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
		let index = -1;
		for (let i = 0; i < this.__threads.length; i++) {
			const thread = this.__threads[i];
			if (thread.name == name) {
				index = i;
				break;
			}
		}
		let rval = null;
		if (index != -1) {
			rval = this.__threads[index];
		}

		return rval;
	}

	// Returns the Thread with the given id
	private threadWithID(id: number): Thread {
		let rval: Thread = null;

		for (let i = 0; i < this.__threads.length; i++) {
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
		const outputEvent = new OutputEvent(text, category);
		this.sendEvent(outputEvent);
		console.log(text);
	}

	protected pout(text) {
		this.output(chalk.magenta(text), "stdout");
	}

	protected perr(text) {
		this.output(text, "stderr");
	}

	protected setUpSideChannel(){
		const self = this;
		this.sideChannel = s("http://localhost:" + this._sideChannelPort);

		this.sideChannel.on('connect-to-repl-complete', (resp) =>  {
			const respId = resp["id"];
			let reqData = self.requestData[respId];
			let response = reqData["response"];

			delete self.requestData[respId];

			// we just start to run until we hit a breakpoint or an exception
			response.body = {
				/** If true, the continue request has ignored the specified thread and continued all threads instead. If this attribute is missing a value of 'true' is assumed for backward compatibility. */
				allThreadsContinued: true
			};

			self.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: ClojureDebugSession.THREAD_ID });


			// announce that we are ready to accept breakpoints -> fire the initialized event to give UI a chance to set breakpoints
			self.sendEvent(new InitializedEvent());
		});

		// These two handlers let the extension print to the debug console
		this.sideChannel.on('pout', (data) => {
			this.pout(data);
		});

		this.sideChannel.on('perr', (data) => {
			this.perr(data);
		})

		// used by set breakpoint requests
		this.sideChannel.on('load-namespace-result', (result) => {
			const respId = result["id"];
			const reqData = self.requestData[respId];
			const response = reqData["response"];
			const args = reqData["args"];
			const path = reqData["path"];
			delete self.requestData[respId];
			self.finishBreakPointsRequest(response, args, path)
		});

		// handle exception breakpoint requests
		this.sideChannel.on('get-breakpoint-exception-class-result', (result) => {
			const respId = result["id"];
			const reqData = self.requestData[respId];
			const args = reqData["args"];
			const response = reqData["response"];
			delete self.requestData[respId];
			let type = "none";
			if (args.filters.indexOf("all-exceptions") != -1) {
				type = "all";
			}
			let exClass = "Throwable";
			if (result["class"] && result["class"] != "") {
				exClass = result["class"];
				self._replConnection.setExceptionBreakpoint(type, exClass, (err: any, result: any) => {
					if (err) {
						response.success = false;
					} else {
						response.success = true;
					}
					this.sendResponse(response);
				});
			}
		});

		// eval requests
		this.sideChannel.on('eval-code-result', (result) => {
			const respId = result["id"];
			const reqData = self.requestData[respId];
			const response = reqData["response"];

			for (let res of result["result"]) {
				if (res["status"] && res["status"] == ["done"]) {
					delete self.requestData[respId];
				}
				// TODO prevent this from attempting to send more than one response - gather up the results
				// and send them when "status" is "done".
				self.handleResult(response, res);
			}
		});

	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		console.log("INITIALIZE REQUEST");

		//this.configuration = workspace.getConfiguration("clojure-debug");

		this.supportRunInTerminal = (args.supportsRunInTerminalRequest == true);

		response.body.supportsConfigurationDoneRequest = true;

		// We want to have VS Code call evaulate when hovering over source (Not yet. if there is a way to expand to a full
		// form then we will want to do this.)
		response.body.supportsEvaluateForHovers = false;

		// SOME DAY!!!
		response.body.supportsFunctionBreakpoints = false;

		response.body.supportsSetVariable = false;

		let exceptionBreakpointFilter = {filter: "all-exceptions", label: "Exceptions"};
		response.body.exceptionBreakpointFilters = [exceptionBreakpointFilter];

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
			const eventMap = JSON.parse(event);
			const threadName = eventMap["thread"];
			let eventType = eventMap["event-type"];
			const thread = this.threadWithName(threadName);
			let threadId = -1;

			if (thread == null) {
				threadId = this.__threadIndex;
				this.__threads.push(new Thread(threadId, threadName));
				this.__threadIndex = this.__threadIndex + 1;
			} else {
				threadId = thread.id;
			}

			switch (eventType) {
				case "breakpoint":
					//let src = eventMap["src"];
					//line = eventMap["line"];
					this._currentLine = eventMap["line"];
					console.log("Sending breakpoint event to debugger for thread " + threadId);
					this.sendEvent(new StoppedEvent("breakpoint", threadId));
					break;

			  case "step":
				  //let src = eventMap["src"];
					//line = eventMap["line"];
					this._currentLine = eventMap["line"];
					this.sendEvent(new StoppedEvent("step", threadId));
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

			const eventMap = JSON.parse(output);
			const event = eventMap["event"];
			const threadName = eventMap["thread"];
			const thread = this.threadWithName(threadName);
			let threadId = -1;

			if (thread == null) {
				threadId = this.__threadIndex;
				this.__threads.push(new Thread(threadId, threadName));
				this.__threadIndex = this.__threadIndex + 1;
			}

			if (event == "breakpoint") {
				const src = eventMap["src"];
				const line = eventMap["line"];
				this._currentLine = line;
				this.sendEvent(new StoppedEvent("breakpoint", threadId));
			}

		}
		if (output.search(/CDB MIDDLEWARE EVENT/) != -1) {
			this._debuggerSubState = DebuggerSubState.EVENT_IN_PROGRESS;
		}
	}

	private connectToDebugREPL(response: DebugProtocol.LaunchResponse, args: BaseRequestArguments, primaryReplPort: number, replPort: number, debugged_port: number) {
		let self = this;

		this._debuggerRepl.stdout.on('data', (data) => {
			const output = '' + data;

      if ((output.search(/nREPL server started/) != -1)) {
					self._debuggerState = DebuggerState.REPL_READY;
					self._replConnection = new ReplConnection();
					self._replConnection.connect("127.0.0.1", replPort, (err: any, result: any) => {
						if (err) {
							console.log(err);
						}
					});

				console.log("CONNECTED TO REPL");

				if (self._isLaunched) {
					self._debuggerState = DebuggerState.LAUNCH_COMPLETE;
				}

				let debuggedHost = "localhost";
				if (args["replHost"]) {
					debuggedHost = args["replHost"];
				}

				self._replConnection.attach(debuggedHost, debugged_port, (err: any, result: any) => {
					if (err) {
						console.error(err);
					} else {
						console.log("Debugger REPL attached to Debugged REPL");

						// tell the extension to connect
						let replHost = "127.0.0.1";
						if (args["replHost"]) {
							replHost = args["replHost"];
						}
						const reqId = self.getNextRequestId();
						self.requestData[reqId] = {response: response};
						self.sideChannel.emit("connect-to-repl", {id: reqId, hostPort: replHost + ":" + primaryReplPort});

						// start listening for events
						self.handleEvent(null, null);

					}
				});

			}

			self.handleReplOutput(output);

			self.pout(output);

		});

		this._debuggerRepl.stderr.on('data', (data) => {
			this.perr(data);
			console.log(`stderr: ${data}`);
		});
	}

	private setUpDebugREPL(response: DebugProtocol.LaunchResponse, args: BaseRequestArguments){
		const self = this;

		const env = {"HOME": process.env["HOME"]};

		let primaryReplPort = 5555;
		if (args.replPort) {
			primaryReplPort = args.replPort;
		}

		let debugReplPort = 5556;
		if (args.debugReplPort) {
			debugReplPort = args.debugReplPort;
		}

		let debugPort = 8030;
		if (args.debugPort) {
			debugPort = args.debugPort;
		}

		let leinPath = "/usr/local/bin/lein";
		if (args.leinPath) {
			leinPath = args.leinPath;
		}

		self._debuggerRepl = spawn(leinPath, ["repl", ":headless", ":port", "" + debugReplPort], {cwd: this._tmpProjectDir, env: env });
		self._debuggerState = DebuggerState.REPL_STARTED;
		console.log("DEBUGGER REPL STARTED");
		self.connectToDebugREPL(response, args, primaryReplPort, debugReplPort, debugPort);

	}

	private createDebuggerProject(toolsJar: string) {
		// create a tempory lein proejct
		const tmpobj = tmp.dirSync({ mode: 0o750, prefix: 'repl_connnect_' });
		this._tmpProjectDir = tmpobj.name;
		let projectPath = join(tmpobj.name, "project.clj");

		if (os.platform() == "win32") {
			toolsJar = toolsJar.replace(/\\/g, "\\\\");
		}
		let projCljWithTools = projectClj.replace(":resource-paths []",":resource-paths [\"" + toolsJar + "\"]");
		writeFileSync(projectPath, projCljWithTools);
	}

	protected attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments) {
		console.log("ATTACH REQUEST");
		this._sideChannelPort = 3030;
		this._cwd = args.cwd;
		if (args.sideChannelPort) {
			this._sideChannelPort = args.sideChannelPort;
		}
		this.setUpSideChannel();
		this.createDebuggerProject(args.toolsJar);
		this.setUpDebugREPL(response, args);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		console.log("LAUNCH REQUEST");
		this._isLaunched = true;
		const self = this;
		this.createDebuggerProject(args.toolsJar);

		this._cwd = args.cwd;
		console.log("CWD: " + this._cwd);

		let replPort = 5555;
		if (args.replPort) {
			replPort = args.replPort;
		}

		let debugPort = 8030;
		if (args.debugPort) {
			debugPort = args.debugPort;
		}

		this._sideChannelPort = 3030;
		if (args.sideChannelPort) {
			this._sideChannelPort = args.sideChannelPort;
		}

		this.setUpSideChannel();

		let leinPath = "/usr/local/bin/lein";
		if (args.leinPath) {
			leinPath = args.leinPath;
		}

		let argEnv = {};
		if (args.env) {
			argEnv = args.env;
		}
		const home = process.env["HOME"];
		let jvmOpts = "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=" + debugPort;
		if (args.env && args.env["JVM_OPTS"]) {
			jvmOpts = jvmOpts + " " + args.env["JVM_OPTS"];
		}

		const env = {"HOME": home, "CLOJURE_DEBUG_JDWP_PORT": "" + debugPort, "JVM_OPTS": jvmOpts};
		for (let attrname in args.env) {
			if (attrname != "JVM_OPTS") {
				env[attrname] = args.env[attrname];
			}
		}

		const runArgs: DebugProtocol.RunInTerminalRequestArguments = {
			kind: 'integrated',
			title: "Clojure REPL",
			args: args.commandLine,
			cwd: args.cwd,
			env: env
		};

		if (this.supportRunInTerminal && args.console == "integratedTerminal") {

			this.runInTerminalRequest(runArgs, 600000, runResponse => {
				if (runResponse.success) {
					console.log("PRIMARY REPL STARTED");
					this.setUpDebugREPL(response, args);

				} else {
					this.sendErrorResponse(response, -1, "Cannot launch debug target in terminal.");
				}
			});
		} else if (this.supportRunInTerminal && args.console == "externalTerminal") {
			runArgs["kind"] = "external";

			this.runInTerminalRequest(runArgs, 600000, runResponse => {
				if (runResponse.success) {
					console.log("PRIMARY REPL STARTED");
					this.setUpDebugREPL(response, args);

				} else {
					this.sendErrorResponse(response, -1, "Cannot launch debug target in terminal.");
				}
			});

		} else {
			// debug console launch
			 let cmd = args.commandLine[0];

			let cmdArgs = args.commandLine.slice(1, args.commandLine.length);

			this._primaryRepl = spawn(cmd, cmdArgs, {cwd: args.cwd, env: env});

			this._primaryRepl.stdout.on('data', (data) => {
				const output = '' + data;
				self.pout(output);
				console.log(output);

				if ((output.search(/nREPL server started/) != -1)) {
					this.setUpDebugREPL(response, args);
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
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		console.log("Diconnect requested");

		if (this._isLaunched) {
			const self = this;
			// tell the debugger REPL to tell the debugged REPL to exit
			this._replConnection.exit((err: any, result: any): void => {
				// exit the debugger REPL
				self._replConnection.eval(EXIT_CMD, (err: any, result: any): void => {
				// This is never called, apparently.
				});
				// close the connection to the deugger REPL
				self._replConnection.close((err: any, result: any): void => {
					// do nothing
				});
			});
			this.sideChannel.emit("eval","terminate-and-exit");
		} else {
			// exit the debugger REPL
			this._replConnection.eval(EXIT_CMD, (err: any, result: any): void => {
				// This is never called, apparently.
			});
			// close the connection to the debugger REPL
			this._replConnection.close((err: any, result: any): void => {
					// do nothing
			});
			this.sideChannel.emit("eval","exit");
		}

		this.sideChannel.close();
		this.sendResponse(response);
		this.shutdown();
	}

	protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): void {
		console.log("Source request");

	}

	// TODO Fix the check for successful breakpoints and return the correct list
	protected finishBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, path: string): void {
		console.log("FINISH BREAKPOINTS REQUEST");
		const clientLines = args.lines;
		// make exploded jar file paths amenable to cdt
		const cdtPath = path.replace(".jar/", ".jar:");

		const debugLines = JSON.stringify(clientLines, null, 4);
		console.log(debugLines);
		const newPositions = [clientLines.length];
		const breakpoints = [];
		let processedCount = 0;

		delete this._breakPoints[path];

		const self = this;
		for (let i = 0; i < clientLines.length; i++) {
			const index = i;
			const l = self.convertClientLineToDebugger(clientLines[i]);
			self._replConnection.setBreakpoint(cdtPath, l, (err: any, result: any) => {
				console.log(result);
				processedCount = processedCount + 1;
				let verified = false;
				const rval = result[0]["msg"];
				if (rval.indexOf("No breakpoints found ") == -1) {
					verified = true;
				}
				newPositions[index] = l;
				if (verified) {
					breakpoints.push({ verified: verified, line: self.convertDebuggerLineToClient(l) });
				}

				if (processedCount == clientLines.length) {
					self._breakPoints[path] = newPositions;

					// send back the actual breakpoints
					response.body = {
						breakpoints: breakpoints
					};
					const debug = JSON.stringify(response, null, 4);
					console.log(debug);
					self.sendResponse(response);
				}
			});

		}
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		console.log("Set breakpoint requested");
		const clientLines = args.lines;

		const debugLines = JSON.stringify(clientLines, null, 4);
		console.log(debugLines);
		const path = args.source.path;
		// make exploded jar file paths amenable to cdt
		const cdtPath = path.replace(".jar/", ".jar:/");
		const reqId = this.getNextRequestId();
		this.requestData[reqId] = {response: response, args: args, path: path};
		const self = this;

		this._replConnection.clearBreakpoints(cdtPath, (err: any, result: any) => {
			if (err) {
				// TODO figure out what to do here
				console.error(err);
			} else {
				const fileContents = readFileSync(path);
				//const regex = /\(ns\s+?(.*?)(\s|\))/;
				const regex = /\(ns(\s+\^\{[\s\S]*?\})?\s+([\w\.\-_\d\*\+!\?]+)/;
				const ns = regex.exec(fileContents.toString())[2];

				// Load the associated namespace into the REPL.
				// We have to use the extension connection to load the namespace
				// We must wait for the response before replying with the SetBreakpointResponse.
				self.sideChannel.emit("load-namespace", {id: reqId, ns: ns});
			}
		});

		// TODO reject breakpoint requests outside of a namespace

	}

	protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
		// get the class type for the exceptions from the extension (response handler will do the rest)
		const reqId = this.getNextRequestId();
		this.requestData[reqId] = {response: response, args: args}
		this.sideChannel.emit('get-breakpoint-exception-class', {id: reqId});
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
		console.log("STACK TRACE REQUEST");
		const levels = args.levels;
		const threadId = args.threadId;
		console.log("LEVELS: " + levels);
		console.log("THREAD_ID: " + threadId);
		const th = this.threadWithID(threadId)
		const debug = this;
		this._replConnection.listFrames(th.name, (err: any, result: any) => {
			console.log(result);
			const resFrames = result[0]["frames"];
			console.log(resFrames);

			// make all source files available (unzipping jars as needed)
			const sourcePaths: string[] = resFrames.map((frame: any, index: number) : string => {
				return frame["srcPath"];
			});

			// let sideChannel = s("http://localhost:" + debug._sideChannelPort);
			// sideChannel.on('go-eval', (data) => {

			// 	sideChannel.on('source-path-result', (result) => {

					const frames: StackFrame[] = resFrames.map((frame: any, index: number): StackFrame => {
						// let sourcePath = result[i];
						let sourcePath = sourcePaths[index];
						let line = frame["line"];
						const f = new StackFrame(index, `${frame["srcName"]}(${index})`, new Source(frame["srcName"], debug.convertDebuggerPathToClientPath(sourcePath, line)), debug.convertDebuggerLineToClient(line), 0);
						f["threadName"] = th.name;
						return f;
					});

					debug._frames = frames;

					response.body = {
						stackFrames: frames
					};
					debug.sendResponse(response);

				// 	sideChannel.close();

				// });

				// sideChannel.emit('get-source-paths', sourcePaths);
			// });
		});
	}

	// Store a variable so it can be inspected by the user in the debugger pane. Structured values
	// are stored recursively to allow for expansion during inspection.
	private storeValue(name: string, val: any): any {
		if (val == null) {
			return {name :name, value: null, variablesReference: 0};
		} else if (val._keys) {
			let vals = val._keys.map((key: any) : any => {
				return this.storeValue(key, val[key]);
			});
			let ref = this._variableHandles.create(vals);
			return {name: name, value: "" + val, variablesReference: ref};
		} else if (val instanceof Array) {
			let index = 0;
			let vals = val.map((v: any) : any => {
				return this.storeValue("" + index++, v);
			});

			let ref = this._variableHandles.create(vals);
			return {name: name, value: "" + val, variablesReference: ref};
		} else if (val instanceof Object) {
			let vals = Object.getOwnPropertyNames(val).map((key: any) : any => {
				return this.storeValue(key, val[key]);
			});
			let ref = this._variableHandles.create(vals);
			return {name: name, value: "" + val, variablesReference: ref};
		} else {
			return {name: name, value: "" + val, variablesReference: 0};
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
			let variables = result[0]["vars"];
			variables = parse(variables);
			let jsVars = toJS(variables);
			let jv = JSON.stringify(jsVars);
			let frameVars = JSON.parse(jv);
			let frameArgs = frameVars[0];
			let frameLocals = frameVars[1];

			// console.log("VARS: " + jsVars);
			// const frameArgs = variables[0];
			// const frameLocals = variables[1];
			const argScope = frameArgs.map((v: any): any => {
				let name = Object.getOwnPropertyNames(v)[0];
				let value = v[name];
				let val = debug.storeValue(name, value);
				return val;
			});
			const localScope = frameLocals.map((v: any): any => {
				let name = Object.getOwnPropertyNames(v)[0];
				let value = v[name];
				let val = debug.storeValue(name, value);
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
		let variables = [];

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
		console.log("STEP OVER REQUEST");
		const threadId = args.threadId;
		const th = this.threadWithID(threadId)
		const debug = this;
		this._replConnection.stepOver(th.name, (err: any, result: any) => {
			// TODO handle errors
			debug.sendResponse(response);
		});
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		console.log("STEP IN REQUEST");
		const threadId = args.threadId;
		const th = this.threadWithID(threadId)
		const debug = this;
		this._replConnection.stepInto(th.name, (err: any, result: any) => {
			// TODO handle errors
			debug.sendResponse(response);
		});
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		console.log("STEP OUT REQUEST");
		const threadId = args.threadId;
		const th = this.threadWithID(threadId)
		const debug = this;
		this._replConnection.stepOut(th.name, (err: any, result: any) => {
			// TODO handle errors
			debug.sendResponse(response);
		});
	}

	private isErrorStatus(status: Array<string>): boolean {
		return (status.indexOf("error") != -1)
	}

	private getErrorMessage(status: Array<string>): string {
		for (let msg of status) {
			if (msg != "done" && msg != "error") {
				return msg;
			}
		}

		return "UNKNOWN ERROR";
	}

	// Handle the result from an eval NOT at a breakpoint. Results sometimes come in more than one response,
	// so we have to gather them until complete (indicated by the presense of the "status" in the
	// response). We use the session-id of the nrepl request to group respones together.
	private handleResult(response: DebugProtocol.EvaluateResponse, replResult: any): void {
		// forward stdout from the REPL to the debugger
		const out = replResult["out"];
		if (out && out != "") {
			this.pout(out);
		}

		// forwared stderr from the REPL to the debugger
		const err = replResult["err"];
		if (err && err != "") {
			this.perr(err);
		}

		// TODO there might be a race condition here. Maybe better to use request id instead
		// of session
		const session = replResult["session"];
		const result = this._evalResults[session] || {};
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

				const err = result["error"];
				if (err && err != "") {
					response.success = false;
					response.message = err;
				}

				this.sendResponse(response);
				delete this._evalResults[session];

			} else if (status[0] == "eval-error") {
				const ex = replResult["ex"];
				if (ex && ex != "") {
					const err = result["error"] || "";
					result["error"] = err + "\n" + ex;
				}
			}
		} else {

			if (replResult["value"]) {
				const value = result["value"] || "";
				result["value"] = value + replResult["value"];
			}

			this._evalResults[session] = result;
		}
	}

	private handleFrameResult(response: DebugProtocol.EvaluateResponse, replResult: any): void {
		// forward stdout form the REPL to the debugger
		const out = replResult["out"];
		if (out && out != "") {
			this.pout(out);
		}

		// forwared stderr from the REPL to the debugger
		const err = replResult["err"];
		if (err && err != "") {
			this.perr(err);
		}

		const session = replResult["session"];
		// const result = this._evalResults[session] || {};
		const result = replResult["value"];
		if (replResult["status"] && replResult["status"][0] == "done") {
			response.body = {
				// result: result["value"],
				result: result,
				// TODO implement this for complex results
				variablesReference: 0
			}

			const err = result["error"];
			if (err && err != "") {
				response.success = false;
				response.message = err;
			}

			this.sendResponse(response);
			this._evalResults[session] = null;

		} else {

			if (replResult["value"]) {
				const value = result["value"] || "";
				result["value"] = value + replResult["value"];
			}
			const ex = replResult["ex"];
			if (ex && ex != "") {
				const err = result["error"] || "";
				result["error"] = err + "\n" + ex;
			}
			this._evalResults[session] = result;
		}
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		const expr = args.expression;
		const self = this;
		const ns = 'user';

		if (args.context == 'repl' || args.context == 'watch') {
			if (args.frameId != null) {
				console.log("FRAME EVAL REQUESTED");
				// evaluate in the context of the given thread/frame
				this._replConnection.reval(args.frameId, expr, (err: any, result: any) => {
					for (let res of result) {
 						self.handleFrameResult(response, res);
					}
				});

			} else {
				// use extesion to eval code
				console.log("EVAL REQUESTED");
				const reqId = self.getNextRequestId();
				self.requestData[reqId] = {response: response, args: args};
				this.sideChannel.emit('eval-code', {id: reqId, expression: expr});
		  }
		}
	}
}

DebugSession.run(ClojureDebugSession);
