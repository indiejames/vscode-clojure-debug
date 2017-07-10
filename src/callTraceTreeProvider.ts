import {commands, Event, EventEmitter, ExtensionContext, ProviderResult, TreeDataProvider, TreeItem,
	    TreeItemCollapsibleState, Uri, window} from 'vscode'
import * as path from 'path'
import * as walk from 'tree-walk'
import { parseTrace, parseTraces } from './clojureTraceParser'
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
	public file: string
	public line: number

	constructor(label: string, public parent: CallNode, context: ExtensionContext) {
		super(label, parent)

		// these get added to this nodes children automatically in their constructors
		const jumpNode = new JumpNode(this, context)
		const argsNode = new CallNode("Args", this)
		argsNode.collapsibleState = TreeItemCollapsibleState.Collapsed
		const rvalNode = new CallNode("Return", this)
		rvalNode.collapsibleState = TreeItemCollapsibleState.Collapsed

		this.collapsibleState = TreeItemCollapsibleState.Expanded
		this.iconPath = {
			light: context.asAbsolutePath(path.join('resources', 'light', 'function-mathematical-symbol.svg')),
			dark: context.asAbsolutePath(path.join('resources', 'dark', 'function-mathematical-symbol.svg'))
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

// Jump nodes show icons that can be used to jump to the code definition for a function.
export class JumpNode extends CallNode {
	public file: string
	public line: number

	constructor(public parent, context: ExtensionContext) {
		super("", parent)
		this.collapsibleState = TreeItemCollapsibleState.None
		this.iconPath = {
			light: context.asAbsolutePath(path.join('resources', 'light', 'right-arrow.svg')),
			dark: context.asAbsolutePath(path.join('resources', 'dark', 'right-arrow.svg'))
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
	private headMap: Map<string, CallNode> = null
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
		this.root.depth = -2
		this.headMap = new Map<string, FunctionCallNode>()

		if (this.isTracing) {
			const self = this
			// tell Clojure to stop tracing
			this.replConnection.stopTrace((err: any, result: any) => {
				if (err) {
					window.showErrorMessage("Error stopping trace on REPL")
				} else {
					self.addTrace(result[0]["trace"])
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
			if (value != null) {
				this.namespaceRegex = value
				this.setREPLNamespaces()
			}
		});
	}

	// tell the REPL to start tracing matching namespaces
	private setREPLNamespaces() {
		if (this.isTracing) {
			const regex = this.namespaceRegex.replace(".*", "\..*")
			this.replConnection.trace(regex, (err: any, result: any) => {
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

				// TODO I think this doesn't work if two values are
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

	public addTraceStep(threadName: string, head: FunctionCallNode, trace: any) {
		const depth = trace["depth"]
		const fname = trace["fname"]
		const args = trace["args"]
		const value = trace["value"]
		const nsFunc = fname.split("/")

		const newNode = new FunctionCallNode(fname, head, this.context)

		newNode.depth = depth
		const argsNode = newNode.getChildren()[1]
		this.addValueNodeSubTree(argsNode, args)
		const rvalNode = newNode.getChildren()[2]
		this.addValueNodeSubTree(rvalNode, value)
		this.headMap[threadName] = newNode

		this.replConnection.findDefinition(nsFunc[0], nsFunc[1], (err: any, result: any) => {
			if(err) {
				window.showErrorMessage("Can't find file for " + fname)
			} else {
				let res = result[0];
				if (res["message"]) {
					// hack to get around false triggers, but keep warning about protocols
					if (res["message"].match(/^Definition lookup for protocol methods.*$/)) {
						window.showInformationMessage(res["message"]);
					}

				} else {
					const jumpNode = newNode.getChildren()[0] as JumpNode
					jumpNode.file = normalizePath(res["path"]);
					jumpNode.line = res["line"] - 1;

					jumpNode.updateCommand()
					this.refresh()
				}
			}
		})
	}

	public addTrace(traces: string) {
		const traceMap = parseTrace(traces)
		Object.keys(traceMap).sort().forEach(key => {
			const threadName: string = key
			const threadTrace: any = traceMap[threadName]
			Object.keys(threadTrace).sort().forEach(key => {
				const trace: any = threadTrace[key]
				const depth = trace["depth"]

				let head = this.headMap[threadName]
				if (!head) {
					head = new CallNode(threadName, this.root)
					head.collapsibleState = TreeItemCollapsibleState.Expanded
					head.depth = -1
				}

				if (depth <= head.depth) {
					head = head.parent as CallNode
				}

				this.addTraceStep(threadName, head, trace)

			})

		})


		this.refresh()

	}

}