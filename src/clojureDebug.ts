/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

"use strict";

///<reference path="node.d.ts"/>

import {DebugSession, InitializedEvent, TerminatedEvent, StoppedEvent, OutputEvent, Thread, StackFrame, Scope, Source, Handles} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync} from 'fs';
import {basename, dirname} from 'path';
import {spawn} from 'child_process';
import nrepl_client = require('nrepl-client');

// Constants to represent the various states of the debugger
class DebuggerState {
	public static get PRE_LAUNCH(): string { return "PRE_LAUNCH";}
	public static get REPL_STARTED(): string {return "REPL_STARTED";}
	public static get DEBUGGER_ATTACHED(): string {return "DEBUGGER_ATTACHED";}
	public static get REPL_READY(): string {return "REPL_READY";}
	public static get LAUNCH_COMPLETE(): string {return "LAUNCH_COMPLETE";}
}


/**
 * This interface should always match the schema found in the mock-debug extension manifest.
 */
export interface LaunchRequestArguments {
	/** An absolute path to the program to debug. */
	program: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
}

class ClojureDebugSession extends DebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static THREAD_ID = 1;

	// Clojure REPL process
	private _cdtRepl: any;
	private _primaryRepl: any;

	private __currentLine: number;
	private get _currentLine() : number {
        return this.__currentLine;
    }
	private set _currentLine(line: number) {
        this.__currentLine = line;
		this.sendEvent(new OutputEvent(`line: ${line}\n`));	// print current line on debug console
    }

	private _sourceFile: string;
	private _sourceLines: string[];
	private _breakPoints: any;
	private _variableHandles: Handles<string>;
	private _connection: nrepl_client.Connection;
	// Debugger state
	private _debuggerState: DebuggerState;
	// map of sessions ids to evalulation results
	private _evalResults: any;

	public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
		super(debuggerLinesStartAt1, isServer);
		this._sourceFile = null;
		this._sourceLines = [];
		this._currentLine = 0;
		this._breakPoints = {};
		this._variableHandles = new Handles<string>();
		this._debuggerState = DebuggerState.PRE_LAUNCH;
		this._evalResults = {};
	}

	// send data form the REPL's stdout to be displayed in the debugger
	protected output(text, category){
		var outputEvent = new OutputEvent(text, category);
		this.sendEvent(outputEvent);
    console.log(text);
	}

	protected pout(text){
	 this.output(text, "stdout");
	}

	protected perr(text){
		this.output(text, "stderr");
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// announce that we are ready to accept breakpoints -> fire the initialized event to give UI a chance to set breakpoints
		this.sendEvent(new InitializedEvent());

		super.initializeRequest(response, args);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		this._sourceFile = args.program;
		this._sourceLines = readFileSync(this._sourceFile).toString().split('\n');
		var env = {"JVM_OPTS": "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=8030"};
		var cwd = dirname(args.program);

		this._primaryRepl = spawn('/usr/local/bin/lein', ["repl", ":headless", ":port", "5555"], {cwd: cwd, env: env});
		this._debuggerState = DebuggerState.REPL_STARTED;

  	this._primaryRepl.stdout.on('data', (data) => {
    		var output = '' + data;

				// TODO This should check the message instead of assuming the second
				// message means the REPL is ready to receive connections.
				if (this._debuggerState == DebuggerState.REPL_READY) {
					this._debuggerState = DebuggerState.REPL_READY;
					this._connection = nrepl_client.connect({port: 5555, host: "127.0.0.1", verbose: false});

					this._debuggerState = DebuggerState.LAUNCH_COMPLETE;
					if (args.stopOnEntry) {
						this._currentLine = 0;
						this.sendResponse(response);

						// we stop on the first line
						this.sendEvent(new StoppedEvent("entry", ClojureDebugSession.THREAD_ID));
					} else {
						// we just start to run until we hit a breakpoint or an exception
						this.continueRequest(response, { threadId: ClojureDebugSession.THREAD_ID });
					}
				}

				if (this._debuggerState == DebuggerState.DEBUGGER_ATTACHED) {
					this._debuggerState = DebuggerState.REPL_READY;
				}

				if (this._debuggerState == DebuggerState.REPL_STARTED) {
					this._debuggerState = DebuggerState.DEBUGGER_ATTACHED;
				}

				this.pout(output);

		});

  	this._primaryRepl.stderr.on('data', (data) => {
			this.perr(data);
  		console.log(`stderr: ${data}`);
		});

		this._primaryRepl.on('close', (code) => {
			if (code !== 0) {
				console.log(`REPL process exited with code ${code}`);
			}
			console.log("REPL closed");
		});


	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {

		var path = args.source.path;
		// TEST CODE
		path = "/Users/jnorton/Clojure/repl_test/src/repl_test/core.clj";

		// read file contents
		var fileContents = readFileSync(path);
		var regex = /\(ns\s+?(.*?)(\s|\))/;
		var ns = regex.exec(fileContents.toString())[1];

		// load the associated namespace into the REPL

		this._connection.send({op: 'require-namespace', namespace: ns}, (err: any, result: any) => {
			// TODO handle errors here
			console.log(result);
		});


		var clientLines = args.lines;


		// read file contents into array for direct access
		var lines = fileContents.toString().split('\n');

		var newPositions = [clientLines.length];
		var breakpoints = [];

		// verify breakpoint locations
		for (var i = 0; i < clientLines.length; i++) {
			var l = this.convertClientLineToDebugger(clientLines[i]);

			this._connection.send({op: 'set-breakpoint', line: l, path: path}, (err: any, result: any) => {
				console.log(result);
			});


			// this._connection.send({op: 'set-breakpoint', line: l, path: path}, function (err, result) {
			// 	console.log(result);
			// });

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
			breakpoints.push({ verified: verified, line: this.convertDebuggerLineToClient(l)});
		}
		this._breakPoints[path] = newPositions;

		// send back the actual breakpoints
		response.body = {
			breakpoints: breakpoints
		};
		this.sendResponse(response);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// return the default thread
		response.body = {
			threads: [
				new Thread(ClojureDebugSession.THREAD_ID, "thread 1")
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {

		const frames = new Array<StackFrame>();
		const words = this._sourceLines[this._currentLine].trim().split(/\s+/);
		// create three fake stack frames.
		for (let i= 0; i < 3; i++) {
			// use a word of the line as the stackframe name
			const name = words.length > i ? words[i] : "frame";
			frames.push(new StackFrame(i, `${name}(${i})`, new Source(basename(this._sourceFile), this.convertDebuggerPathToClient(this._sourceFile)), this.convertDebuggerLineToClient(this._currentLine), 0));
		}
		response.body = {
			stackFrames: frames
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		const frameReference = args.frameId;
		const scopes = new Array<Scope>();
		scopes.push(new Scope("Local", this._variableHandles.create("local_" + frameReference), false));
		scopes.push(new Scope("Closure", this._variableHandles.create("closure_" + frameReference), false));
		scopes.push(new Scope("Global", this._variableHandles.create("global_" + frameReference), true));

		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {

		const variables = [];
		const id = this._variableHandles.get(args.variablesReference);
		if (id != null) {
			variables.push({
				name: id + "_i",
				value: "123",
				variablesReference: 0
			});
			variables.push({
				name: id + "_f",
				value: "3.14",
				variablesReference: 0
			});
			variables.push({
				name: id + "_s",
				value: "hello world",
				variablesReference: 0
			});
			variables.push({
				name: id + "_o",
				value: "Object",
				variablesReference: this._variableHandles.create("object_")
			});
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {

		const lines = this._breakPoints[this._sourceFile];
		for (let ln = this._currentLine+1; ln < this._sourceLines.length; ln++) {
			// is breakpoint on this line?
			if (lines && lines.indexOf(ln) >= 0) {
				this._currentLine = ln;
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("breakpoint", ClojureDebugSession.THREAD_ID));
				return;
			}
			// if word 'exception' found in source -> throw exception
			if (this._sourceLines[ln].indexOf("exception") >= 0) {
				this._currentLine = ln;
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("exception", ClojureDebugSession.THREAD_ID));
				this.sendEvent(new OutputEvent(`exception in line: ${ln}\n`, 'stderr'));
				return;
			}
		}
		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {

		for (let ln = this._currentLine+1; ln < this._sourceLines.length; ln++) {
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

	protected handleResult(response: DebugProtocol.EvaluateResponse, replResult: any): void {
		// forward stdout form the REPL to the debugger
		var out = replResult["out"];
		if (out && out != ""){
			this.pout(out);
		}

		// forwared stderr from the REPL to the debugger
		var err = replResult["err"];
		if (err && err != ""){
			this.perr(err);
		}

		var session = replResult["session"];
		var result = this._evalResults[session] || {};
		if (replResult["status"] == "done") {
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

		} else {

			if (replResult["value"]) {
				var value = result["value"] || "";
				result["value"] = value + replResult["value"];
			}
			var ex = replResult["ex"];
			if (ex && ex != "") {
				var err = result["error"] || "";
				result["error"] = err + "\n" +  ex;
			}
			this._evalResults[session] = result;
		}
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		var expr = args.expression;
		var self = this;
		this._connection.eval(expr, (err: any, result: any) => {

			for (var res of result){
				this.handleResult(response, res);
			}

			// var value = result.reduce((res: any, msg: any) => {
			// 	return msg.value ? res + msg.value : res;}, "");

			// response.body = {
			// 	result: value,
			// 	variablesReference: 0
			// };
			// self.sendResponse(response);

		});


	}
}

DebugSession.run(ClojureDebugSession);
