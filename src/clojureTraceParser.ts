/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// Parses clojure s-expressions from trace output into JSON maps

"use strict";

import {parse, toJS} from 'jsedn';

// Takes a string for a functions args and converts it to JSON. Tagged epxressions are split into
// tuple vectors consisting of the tag as a string and an expression for the value, e.g.,
//
//     #TestRecord{:x 1, :y 2, :z 3} => ["#TestRecord" {:x 1, :y 2, :z 3}]
//
function parseArgsExpression(exp: string): string {
	// handle tagged expressions
	// const m = exp.match(/(#.*?)([{\[].*})/)
	if (exp === "nil") {
		return "nil"
	} else {
		const parsedExp = parse(exp)
		const jsonExp = toJS(parsedExp)
		return jsonExp
	}
}

export function parseTrace(trace: string): any {
	let parsedExp
	try {
		parsedExp = parse(trace)
		// parsedExp = JSON.parse(trace)
	} catch (e) {
		console.log(e)
	}
	return toJS(parsedExp)
}

// Returns an array of maps of trace information obtained from parsing the given string.
// Traces have the form of 'TRACE t1234: | (some clojure code)' or
// 'TRACE t1234: => some clojure expression'. There may be more than one trace in the input.
export function parseTraces(trace: string): any[] {
	let rval = []
	let matches = trace.match(/<TRACE: t(\d+?)>.*?<\/TRACE: t\1>/g) || []

	for (let line of matches) {
		let match

		if (match = line.match(/<TRACE: t(\d+?)>((\| )*)\((\S*?)( (.*)|)\)<\/TRACE: t\1>/)) {
			const traceMap = {}
			traceMap["traceId"] = match[1]
			const depthMarker = match[2]
			const depth = depthMarker.length / 2
			traceMap["depth"]= depth
			traceMap["funcName"] = match[4]
			// Add square brackets to treat arguments as a vector
			let args = match[6] ? match[6] : ""
			const exp = "[" + args + "]"
			traceMap["args"] = parseArgsExpression(exp)

			rval.push(traceMap)

		} else if (match = line.match(/<TRACE: t(\d+?)>((\| )*)=> (.*?)<\/TRACE: t\1>/)) {
			const traceMap = {}
			traceMap["traceId"] = match[1]
			const depthMarker = match[2]
			const depth = depthMarker.length / 2
			traceMap["depth"] = depth
			const result = match[4]
			traceMap["result"] = parseArgsExpression(result)

			rval.push(traceMap)
		}
	}


	return rval
}

// parseTrace("TRACE t19407: (repl-test.core/two {:a \"A\", :y {:x 7, :z [1 2 #repl_test.core.TestRecord{:x 1, :y 2, :z 3}]}})")
// parseExpression("#TestRecord{:x 1, :y 2, :z 3}")