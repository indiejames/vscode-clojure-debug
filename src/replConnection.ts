/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {spawn} from 'child_process';
import nrepl_client = require('jg-nrepl-client');

interface callbackType { (err: any, result: any): void }

function escapeClojureCodeInString(code: string): string {
	let escaped = code.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
	return "\"" + escaped + "\"";
}

function wrapCodeInReadEval(code: string): string {
	let escapedCode = escapeClojureCodeInString(code);
	return "(eval (read-string {:read-cond :allow} " + escapedCode + "))";
}

/*
	Repl - data and methods related to communicating with a REPL process.
*/
export class ReplConnection {
	private conn: nrepl_client.Connection; // The connection to the REPL
	private session: any;
	private commandSession: any;

	// don't initialize anything in the constuctor - wait until connect is called
	constructor() {
	}

	private doConnect(port: number, host: string, callback: callbackType) {
		let self = this;
		console.log("Connecting to port " + port + " on host " + host + "...");
		this.conn = nrepl_client.connect({port: port, host: host, verbose: false});

		this.conn.on('error', (error: any) => {
			if (error.code == 'ECONNREFUSED'){
				setTimeout(() => {
					self.doConnect(port, host, callback);
				}, 1000);
			}
		});

		if (this.conn) {
			self.conn.clone((err: any, result: any) => {
				self.session = result[0]["new-session"];
				console.log("Eval session: " + self.session);
				self.conn.clone((err: any, result: any) => {
					self.commandSession = result[0]["new-session"];
					console.log("Command session: " + self.commandSession);
					if(err) {
						console.error(err);
						callback(err, null);
					} else {
						callback(null, result);
					}
				});
			});
		}
	}

	// set up the internal connection to a REPL
	public connect(replHost: string, replPort: number, callback: callbackType) {
		let self = this;

		if (this.conn){
			this.conn.close((err: any, result: any) => {
				if(err) {
					console.error(err);
					callback(err, null);
				}
			});
		}

		// this.conn = nrepl_client.connect({port: replPort, host: replHost, verbose: false});
		this.doConnect(replPort, replHost, callback);
	}

	public isConnected(){
		return this.conn != null;
	}

	// attach this REPL to the debugged REPL
	public attach(port: number, callback: callbackType) {
		this.conn.send({op: 'attach', port: port}, callback);
	}

	// evaluate the given code (possibly in a given namespace)
	public eval(code: string, callback: callbackType, ns?: string) {
		code = wrapCodeInReadEval(code);
		var command = {op: 'eval', code: code, session: this.session};

		if (ns) {
			command["ns"] = ns;
		}

		this.conn.send(command, callback);
	}

	// TODO change all these string keys to keyword: keys

	// evaluate code in the context of a given thread/frame
	public reval(frameIndex: number, code: string, callback: callbackType) {
		this.conn.send({op: 'reval', 'frame-num': frameIndex, 'form': code}, callback);
	}

	// list all the running threads
	public listThreads(callback: callbackType) {
		this.conn.send({op: 'list-threads', 'session': this.commandSession}, callback);
	}

	// list the stack frames for the given thread
	public listFrames(threadName: string, callback: callbackType) {
		this.conn.send({op: 'list-frames', 'thread-name': threadName, 'session': this.commandSession}, callback);
	}

	// list the vars for the given thread / stack frame
	public listVars(threadName: string, frameIndex: number, callback: callbackType) {

		try {
			this.conn.send({op: 'list-vars', 'thread-name': threadName, 'frame-index': frameIndex, 'session': this.commandSession}, callback);
		} catch (e){
			// TODO - remove this when issue #70 is fixed.
			// This is a hack to handle weird values that come back on some exception stack frames - they aren't
			// handled by bencode correctly and cause exceptions.
			// Issue #70 has been filed to fix this.
			callback(null, "[[][]]");
		}
	}

	// get the source file paths for the given paths. if a source is in a jar file the
	// jar file will be extracted on the file system and the path to the extracted file
	// returned
	public getSourcePaths(paths: string[], callback: callbackType) {
		this.conn.send({op: 'get-source-paths', 'source-files': paths, session: this.commandSession}, callback);
	}

	// set a breakpoint at the given line in the given file
	public setBreakpoint(path: string, line: number, callback: callbackType) {
		this.conn.send({op: 'set-breakpoint', line: line, path: path, 'session': this.commandSession}, callback);
	}

	// set a breakpoint for exceptions. type is one of 'all', 'uncaught', or 'none', indicating that exception breakpoints
	// should be cleared
	public setExceptionBreakpoint(type: string, callback: callbackType) {
		this.conn.send({op: 'set-exception-breakpoint', type: type}, callback);
	}

	// clear all breakpoints for the given file
	public clearBreakpoints(path: string, callback: callbackType) {
		this.conn.send({op: 'clear-breakpoints', path: path, 'session': this.commandSession}, callback);
	}

	// find the file and line where a function is defined
	public findDefinition(ns: string, symbol: string, callback: callbackType) {
		this.conn.send({op: 'find-definition', ns: ns, sym: symbol, 'session': this.commandSession}, callback);
	}

	// find the completions for the prefix using Compliment
	public findCompletions(ns: string, prefix: string, src: string, offset: number, callback: callbackType) {
		this.conn.send({op: 'get-completions', ns: ns, prefix: prefix, src: src, pos: offset, session: this.commandSession}, callback);
	}

	// get the docstring for the given vars
	public doc(ns: string, variable: string, callback: callbackType) {
		this.conn.send({op: 'doc', ns: ns, var: variable, session: this.commandSession}, callback);
	}

	// run all the tests in the project
	public runAllTests(callback: callbackType) {
		this.conn.send({op: 'run-all-tests', session: this.commandSession}, callback);
	}

	// run all the tests in a single namespace
	public runTestsInNS(ns: string, callback: callbackType) {
		this.conn.send({op: 'run-tests-in-namespace', ns: ns, session: this.commandSession}, callback);
	}

	// run a single tests
	public runTest(ns: string, testName: string, callback: callbackType) {
		this.conn.send({op: 'run-test', 'test-name': testName, ns: ns, session: this.commandSession}, callback);
	}

	// continue after a breakpoint
	public continue(callback: callbackType) {
		this.conn.send({op: 'continue', 'session': this.commandSession}, callback);
	}

	// get and process a single event using the given callback
	public getEvent(callback: callbackType) {
		this.conn.send({op: 'get-event', 'session': this.commandSession}, callback);
	}

	// reload any changed namespaces
	public refresh(callback: callbackType) {
		this.conn.send({op: 'refresh', 'session': this.commandSession}, callback);
	}

	public setIgnore(callback: callbackType) {
		this.conn.eval("(alter-var-root #'*compiler-options* assoc :disable-locals-clearing true)", null, this.commandSession, (err: any, result: any) => {
			if (err){
				console.error("Error setting compiler options on debugged process.");
			}
		});
	}

	public close(callback: callbackType) {
		this.conn.close(callback);
		this.conn = null;
		this.session = null;
		this.commandSession = null;
	}
}