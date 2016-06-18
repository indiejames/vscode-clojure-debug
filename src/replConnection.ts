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
				self.conn.clone((err: any, result: any) => {
					self.commandSession = result[0]["new-session"];
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
			this.conn.send({op: 'list-threads', 'session': this.session}, callback);
	}

	// list the stack frames for the given thread
	public listFrames(threadName: string, callback: callbackType) {
		this.conn.send({op: 'list-frames', 'thread-name': threadName, 'session': this.session}, callback);
	}

	// list the vars for the given thread / stack frame
	public listVars(threadName: string, frameIndex: number, callback: callbackType) {
		this.conn.send({op: 'list-vars', 'thread-name': threadName, 'frame-index': frameIndex, 'session': this.session}, callback);
	}

	// set a breakpoint at the given line in the given file
	public setBreakpoint(path: string, line: number, callback: callbackType) {
		this.conn.send({op: 'set-breakpoint', line: line, path: path, 'session': this.session}, callback);
	}

	// clear all breakpoints for the given file
	public clearBreakpoints(path: string, callback: callbackType) {
		this.conn.send({op: 'clear-breakpoints', path: path, 'session': this.session}, callback);
	}

	// find the file and line where a function is defined
	public findDefinition(ns: string, symbol: string, callback: callbackType) {
		this.conn.send({op: 'find-definition', ns: ns, sym: symbol, 'session': this.session}, callback);
	}

	// find the completions for the prefix using Compliment
	public findCompletions(ns: string, prefix: string, src: string, offset: number, callback: callbackType) {
		this.conn.send({op: 'get-completions', ns: ns, prefix: prefix, src: src, pos: offset}, callback);
	}

	// get the docstring for the given vars
	public doc(ns: string, variable: string, callback: callbackType) {
		this.conn.send({op: 'doc', ns: ns, var: variable}, callback);
	}

	// continue after a breakpoint
	public continue(callback: callbackType) {
		this.conn.send({op: 'continue', 'session': this.session}, callback);
	}

	// get and process a single event using the given callback
	public getEvent(callback: callbackType) {
		this.conn.send({op: 'get-event', 'session': this.session}, callback);
	}

	// reload any changed namespaces
	public refresh(callback: callbackType) {
		this.conn.send({op: 'refresh', 'session': this.session}, callback);
	}

	public close(callback: callbackType) {
		this.conn.close(callback);
	}
}