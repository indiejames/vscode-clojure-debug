import {commands, Event, EventEmitter, ExtensionContext, ProviderResult, TreeDataProvider, TreeItem,
	    TreeItemCollapsibleState, Uri, window} from 'vscode'
import * as path from 'path'
import * as walk from 'tree-walk'
import {parseTrace} from './clojureTraceParser'
import {ReplConnection} from './replConnection'
import {normalizePath} from './clojureDefinitionProvider'

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
	public depth
	private context: ExtensionContext
	public file: string
	public line: number

	constructor(label: string, public parent: CallNode, context: ExtensionContext) {
		super(label, parent)
		this.context = context

		// these get added to this nodes children automatically in their constructors
		const argsNode = new CallNode("Args", this)
		argsNode.collapsibleState = TreeItemCollapsibleState.Collapsed
		const rvalNode = new CallNode("Return", this)
		rvalNode.collapsibleState = TreeItemCollapsibleState.Collapsed

		this.collapsibleState = TreeItemCollapsibleState.Expanded
		this.iconPath = {
			light: this.context.asAbsolutePath(path.join('resources', 'light', 'function-mathematical-symbol.svg')),
			dark: this.context.asAbsolutePath(path.join('resources', 'dark', 'function-mathematical-symbol.svg'))
		}
	}

	// needed to allow the node's command to be updated after the file and line are obtained
	// asynchronously
	public updateCommand(){
		this.command = {command: "clojure.openFile",
	                    arguments: [this.file, this.line],
						title: "Open File"}
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
	private isTracing: boolean = false
	private namespaceRegex: string
	private replConnection: ReplConnection
	private context: ExtensionContext;

	 constructor(context: ExtensionContext) {
        this.context = context;
	 }

	public setReplConnection(conn: ReplConnection) {
		this.replConnection = conn
	}

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
		this.root = new FunctionCallNode("root", null, this.context)
		this.root.depth = -1
		this.head = this.root
		this.nodeMap = new Map<any, CallNode>()

		if (this.isTracing) {
			// tell Clojure to stop tracing
			this.replConnection.stopTrace((err: any, result: any) => {
				if (err) {
					window.showErrorMessage("Error stopping trace on REPL")
				} else {
					window.setStatusBarMessage("Tracing Deactivated")
					this.isTracing = false
				}
			})

		} else {
			if (this.namespaceRegex) {
				this.refresh()
				this.isTracing = true
				// tell Clojure to begin tracing
				this.setREPLNamespaces()
			} else {
				window.showErrorMessage("Please set the namespace pattern before attempting to trace code")
			}
		}
	}

	public configure() {
		let options = {prompt: "Namespace patterns, e.g., my-project.data.*|my-project.services.*|..."}
		if (this.namespaceRegex) {
			options["value"] = this.namespaceRegex
		}
		const input = window.showInputBox(options);
		input.then(value => {
			this.namespaceRegex = value.replace(".*", "\..*")
			this.setREPLNamespaces()
		});
	}

	// tell the REPL to start tracing matching namespaces
	private setREPLNamespaces() {
		if (this.isTracing) {
			this.replConnection.trace(this.namespaceRegex, (err: any, result: any) => {
				if (err) {
					window.showErrorMessage("Error setting trace on REPL")
				} else {
					window.setStatusBarMessage("Tracing Activated")
				}
			})
		}
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

		this.refresh()
	}

	// Add a function call and its arguments
	private addStartTrace(head: FunctionCallNode, trace: {}) {
		if (trace["depth"] <= head.depth) {
			// need to move up the call tree
			this.addStartTrace(head.parent as FunctionCallNode, trace)
		} else {
			const traceId = trace["traceId"]
			const nsFuncStr: string = trace["funcName"]
			const nsFunc = nsFuncStr.split("/")

			const newNode = new FunctionCallNode(nsFuncStr, head, this.context)

			this.replConnection.findDefinition(nsFunc[0], nsFunc[1], (err: any, result: any) => {
				if(err) {
					window.showErrorMessage("Can't find file for " + nsFuncStr)
				} else {
					let res = result[0];
					if (res["message"]) {
						// hack to get around false triggers, but keep warning about protocols
						if (result["message"].match(/^Definition lookup for protocol methods.*$/)) {
							window.showInformationMessage(res["message"]);
						}

					} else {
						newNode.file = normalizePath(res["path"]);
						newNode.line = res["line"] - 1;
						newNode.updateCommand()
					}
				}
			})
			const depth = trace["depth"]
			const args = trace["args"]
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