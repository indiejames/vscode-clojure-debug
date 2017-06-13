import {ProviderResult, TreeDataProvider, TreeItem, Uri} from 'vscode';
import * as path from 'path';

interface IEntry {
	name: string
	type: string
}

export class CallNode {
	private resource: Uri
	private children: CallNode[]

	constructor(private parent: CallNode) {
		this.children = []
	}

	public addChild(node: CallNode) {
		this.children.push(node)
	}

	public getName(): string {
		return this.entry.name
	}

	public getChildren(): CallNode[] {
		return this.children
	}
}

export class CallTraceTreeProvider implements TreeDataProvider<CallNode> {
	private root = null

	public getTreeItem(element: CallNode): TreeItem {
		return {
			label: element.getName()
		}
	}

	public getChildren(element?: CallNode):  CallNode[] {
		return element.getChildren()
	}

	public startTrace() {
		this.root = new CallNode(null)
	}
}