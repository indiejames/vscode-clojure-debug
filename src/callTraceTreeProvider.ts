import {Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri} from 'vscode'
import * as path from 'path'
import * as walk from 'tree-walk'
import {parseTrace} from './clojureTraceParser'

export class CallNode extends TreeItem {
	private children: CallNode[]
	constructor(label: string, public parent: CallNode) {
		super(label)
		this.children = []
		if (parent) {
			this.parent.addChild(this)
		}
	}

	public addChild(node: CallNode) {
		this.children.push(node)
	}

	public getChildren(): CallNode[] {
		return this.children
	}
}

// gets the shortened tag name (if any) for the given value
function getTagName(value: any) : string {
	const tag: string = value["tag"]
	const val: string = value["value"]

	let tagName: string = null
	if (tag && val) {
		tagName = tag.slice(tag.lastIndexOf(".") + 1)
	}

	return tagName
}

// Returns true if the given value is a tagged Clojure object, false othewise
function isTagged(value: any): boolean {
	let rval: boolean = false
	if (value instanceof Object) {
		const keys = Object.keys(value)
		const comp = ["tag", "value"]
		if (keys.length == 2) {
			rval = (keys.indexOf("tag") != -1 && keys.indexOf("value") != -1)
		}
	}

	return rval
}

// Returns the string representation for the given value
function getValString(value: any): string {
	let valStr: string = "nil"

	if (value) {

		valStr = value.toString()
		valStr = valStr.replace("[object Object]", "{..}")
		if (value instanceof Array) {
			valStr = "[" + valStr + "]"
		} else if (value instanceof Object) {
			if (isTagged(value)) {
				// Clojure tagged object
				const tagName = getTagName(value)
				valStr = "{#" + tagName + "}"
			} else {
				valStr = "{..}"
			}
		}

		if (valStr.length > 40) {
			valStr = valStr.substr(0, 34) + " ... " + valStr.charAt(valStr.length - 1)
		}

	}

	return valStr
}

// Function call nodes represent the main elements of the call tree.
// Each funciton call nodes has at least two children, args and rval, representing the
// arguments passed to the function and its return value. Children beyond the first two
// are functions called by this function.
export class FunctionCallNode extends CallNode {
	// the file and line number for this function
	private resource: Uri
	public depth

	constructor(label: string, public parent: CallNode) {
		super(label, parent)
		// these get added to this nodes children automatically in their constructors
		const argsNode = new CallNode("Args", this)
		argsNode.collapsibleState = TreeItemCollapsibleState.Collapsed
		const rvalNode = new CallNode("Return", this)
		rvalNode.collapsibleState = TreeItemCollapsibleState.Collapsed

		this.collapsibleState = TreeItemCollapsibleState.Expanded
	}
}

export class ValueNode extends CallNode {

	constructor(label: string, public parent: CallNode) {
		super(label, parent)
	}
}

export class CallTraceTreeProvider implements TreeDataProvider<CallNode> {
	private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
	readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;
	private root: FunctionCallNode = null
	private head: FunctionCallNode = null
	private nodeMap: Map<any, CallNode>

	public getTreeItem(element: CallNode): TreeItem {
		return element
	}

	public getChildren(element?: CallNode):  CallNode[] {
		let children= []

		if (element) {
			children = element.getChildren()
		} else if (this.root) {
			children = this.root.getChildren().slice(2)
		}

		return children
	}

	public startTracing() {
		this.root = new FunctionCallNode("root", null)
		this.root.depth = -1
		this.head = this.root
		this.nodeMap = new Map<any, CallNode>()
	}

	public refresh() {
		this._onDidChangeTreeData.fire();
	}

	// Add node(s) representing a value tree below the given parent node.
	// Example: Add sub-tree representing the args to a function
	//  addValueNodeSubTree(<some call node's args node>, [4, {a: "A"}])
	//  =>
	//  (call node)->(args-node)--->(4)
	//                           |->({})--->("a:")->("A")
	//
	private addValueNodeSubTree(parentNode, value) {

		if (value instanceof Object) {
			let valueNodeMap = {any: CallNode}

			walk.preorder(value, (val: any, key: any, parent: any) => {
				let p = parent ? valueNodeMap[parent] : parentNode
				let label

				let valStr = getValString(val)

				if (key) {
					label = key + ": " + valStr
				} else {
					label = valStr
				}

				let newNode = new ValueNode(label, p)
				if (val instanceof Object) {
					newNode.collapsibleState = TreeItemCollapsibleState.Collapsed
				} else {
					newNode.collapsibleState = TreeItemCollapsibleState.None
				}

				// TODO I think this doens't work if two values are
				// the same
				if (val) {
					valueNodeMap[val] = newNode
				}
			})
		} else {
			const label = value ? value.toString() : "nil"
			const newNode = new ValueNode(label, parentNode)
			newNode.collapsibleState = TreeItemCollapsibleState.None
		}

	}

	// Add the return value for an existing trace
	public finalizeTrace(trace: {}) {
		const traceId = trace["traceId"]
		const node = this.nodeMap[traceId]
		if (node) {
			const rval = trace["result"]
			const rvalNode = node.getChildren()[1]
			this.addValueNodeSubTree(rvalNode, rval)
		}
	}

	// Add a function call and its arguments
	private addStartTrace(head: FunctionCallNode, trace: {}) {
		if (trace["depth"] <= head.depth) {
			// need to move up the call tree
			this.addStartTrace(head.parent as FunctionCallNode, trace)
		} else {
			const traceId = trace["traceId"]
			const depth = trace["depth"]
			const args = trace["args"]
			const newNode = new FunctionCallNode(trace["funcName"], head)
			newNode.depth = depth
			const argsNode = newNode.getChildren()[0]
			this.addValueNodeSubTree(argsNode, args)
			this.head = newNode
			this.nodeMap[traceId] = newNode
		}
	}

	public addTrace(trace: string) {
		const pTrace = parseTrace(trace)
		if (pTrace["result"]) {
			this.finalizeTrace(pTrace)
		} else {
			this.addStartTrace(this.head, pTrace)
		}
	}
}