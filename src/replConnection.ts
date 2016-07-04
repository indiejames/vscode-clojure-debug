/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {spawn} from 'child_process';
import nrepl_client = require('jg-nrepl-client');

interface callbackType { (err: any, result: any): void }

/*
	Repl - data and methods related to communicating with a REPL process.
*/
export class ReplConnection {
	private conn: nrepl_client.Connection; // The connection to the REPL
	private session: any;
	private commandSession: any;

	constructor(replHost: string, replPort: number) {
		  let self = this;
			this.conn = nrepl_client.connect({port: replPort, host: replHost, verbose: false});
			this.conn.clone((err: any, result: any) => {
				self.session = result[0]["new-session"];
				console.log("Eval session: " + self.session);
				self.conn.clone((err: any, result: any) => {
					self.commandSession = result[0]["new-session"];
					console.log("Command session: " + self.commandSession);
				});
			});
	}

	// evaluate the given code (possibly in a given namespace)
	public eval(code: string, callback: callbackType, ns?: string) {
		if (ns) {
			this.conn.eval(code, ns, this.session, callback);
		} else {
			this.conn.eval(code, null, this.session, callback);
		}

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
		this.conn.send({op: 'list-vars', 'thread-name': threadName, 'frame-index': frameIndex, 'session': this.commandSession}, callback);
	}

	// set a breakpoint at the given line in the given file
	public setBreakpoint(path: string, line: number, callback: callbackType) {
		this.conn.send({op: 'set-breakpoint', line: line, path: path, 'session': this.commandSession}, callback);
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

	public close(callback: callbackType) {
		this.conn.close(callback);
	}
}