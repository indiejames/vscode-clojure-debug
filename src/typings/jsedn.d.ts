
declare module "jsedn" {

	export interface Collection {
		at(key: any) : any
		each(iter: (val: any) => any) : any[]
	}
	export interface Map extends Collection {}

	export interface List extends Collection {}
	export interface Vector extends Collection {}
	export interface Set extends Collection {}

	export class Keyword {}

	export function parse(val: string) : List | Vector | Set | Map;

	export function kw(val: string) : Keyword;

	export function toJS(val: any): string;
}

