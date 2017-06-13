/* --------------------------------------------------------------------------------------------
 * Copyright (c) James Norton. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// Parses clojure s-expressions from trace output into JSON maps

"use strict";

import {parse, toJS} from 'jsedn';

// Takes a Clojure s-expression and converts it to JSON. Tagged epxressions are split into
// tuple vectors consisting of the tag as a stirng and an expression for the value, e.g.,
//
//     #TestRecord{:x 1, :y 2, :z 3} => ["#TestRecord" {:x 1, :y 2, :z 3}]
//
function parseExpression(exp: string): string {
	let rval = ""
	// handle tagged expressions
	// const m = exp.match(/(#.*?)([{\[].*})/)
	// const tagSplitExp = exp.replace(/(#.*?)([{\[].*)/, "[\"$1\" $2]")

	return toJS(parse(exp))
}

export function parseTrace(trace: string): {} {
	let rval = {}
	let match

	if (match = trace.match(/TRACE t(\d+):((\s\|)*) \((.*?) (.*)\)/)) {
		rval["traceId"] = match[1]
		const depthMarker = match[2]
		const depth = depthMarker.length / 2
		rval["depth"]= depth
		rval["funcName"] = match[4]
		const exp = match[5]
		rval["exp"] = parseExpression(exp)

	} else if (match = trace.match(/TRACE t(\d+):((\s\|)*) => (.*)/)) {
		rval["traceId"] = match[1]
		const depthMarker = match[2]
		const depth = depthMarker.length / 2
		rval["depth"] = depth
		const result = match[4]
		rval["result"] = parseExpression(result)
	}

	return rval
}

// parseTrace("TRACE t19407: (repl-test.core/two {:a \"A\", :y {:x 7, :z [1 2 #repl_test.core.TestRecord{:x 1, :y 2, :z 3}]}})")
// parseExpression("#TestRecord{:x 1, :y 2, :z 3}")