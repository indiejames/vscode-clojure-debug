/*---------------------------------------------------------------------------------------------
 *  Copyright (c) James Norton. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import assert = require('assert');
import * as Path from 'path';
import {parseTrace} from '../clojureTraceParser'

suite('Trace Parser', () => {

	const callTraceDepth1 = "TRACE t19430: | (repl-test.core/two {:a \"A\", :y {:x 7, :z [1 2 #repl_test.core.TestRecord{:x 1, :y 2, :z 3}]}})"
	const returnTraceDepth1 = "TRACE t19403: | => 49"

	test('depth 1', done => {
		assert.deepEqual({depth: 1,
									funcName: 'repl-test.core/two',
									args: [{":a": "A",
									       ":y": {":x": 7,
											          ":z": [1, 2, {"tag": "repl_test.core.TestRecord",
               					 	 					 			    "value": { ":x": 1,
													 										 					 ":y": 2,
													 															 ":z": 3 }}]}}],
								  traceId: "19430"},
								 parseTrace(callTraceDepth1))

		assert.deepEqual({ traceId: '19403', depth: 1, result: 49},
										  parseTrace(returnTraceDepth1))
		done()

	});

	const callTraceDepth2 = "TRACE t19404: | | (repl-test.core/one {:x 7, :z [1 2 #repl_test.core.TestRecord{:x 1, :y 2, :z 3}]})"
	const returnTraceDepth2 = "TRACE t19404: | | => 49"

	test('depth 2', done => {
		assert.deepEqual({
        depth: 2,
        args: [{
          ":x": 7,
          ":z": [
            1,
            2,
            {
              "tag": "repl_test.core.TestRecord",
              "value": {
                ":x": 1,
                ":y": 2,
                ":z": 3
              }
            }
          ]
        }],
        funcName: "repl-test.core/one",
        traceId: "19404"
      },
										 parseTrace(callTraceDepth2))

		assert.deepEqual({ traceId: '19404', depth: 2, result: 49},
										  parseTrace(returnTraceDepth2))

		done()

	})

	const callTraceMultiArg = "TRACE t19394: | (repl-test.core/foo 4 7)"

	test('multiple arguments', done => {
		assert.deepEqual({
			depth: 1,
			args: [4, 7],
			funcName: "repl-test.core/foo",
			traceId: "19394"
		},
		parseTrace(callTraceMultiArg))

	 done()

	})
});
