import {TreeDataProvider, TreeItem, Uri} from 'vscode';
import * as path from 'path';

interface IEntry {
	name: string;
	type: string;
}

export class CallNode {
	private _resource: Uri;

	constructor(private entry: IEntry, private _parent: string) {

	}
}

// export class CallTraceTreeProvider implements TreeDataProvider<CallNode> {
// 	public getTreeItem(element: CallNode): TreeItem {
// 		return {
// 			label: element.name,
// 		}
// 	}
// }