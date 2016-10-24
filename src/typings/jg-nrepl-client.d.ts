declare module "jg-nrepl-client" {
    import * as net from "net";

	export interface Connection extends net.Socket  {
		send(mesg: any, callback: (err: any, result: any) => void): void;
		eval(code: string, callback: (err: any, result: any) => void): void;
        eval(code: string, ns: string, callback: (err: any, result: any) => void): void;
        eval(code: string, ns: string, session: string, callback: (err: any, result: any) => void): void;
        clone(callback: (err: any, result: any) => void);
        clone(session: any, callback: (err: any, result: any) => void);
        close(callback: (err: any, result: any) => void): void;
	}
	export function connect(opts: any): Connection;
}