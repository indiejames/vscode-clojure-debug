// Type definitions for Node.js v0.12.0
// Project: http://nodejs.org/
// Definitions by: Microsoft TypeScript <http://typescriptlang.org>, DefinitelyTyped <https://github.com/borisyankov/DefinitelyTyped>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/************************************************
*                                               *
*               Node.js v0.12.0 API             *
*                                               *
************************************************/

// compat for TypeScript 1.5.3
// if you use with --target es3 or --target es5 and use below definitions,
// use the lib.es6.d.ts that is bundled with TypeScript 1.5.3.
interface MapConstructor {}
interface WeakMapConstructor {}
interface SetConstructor {}
interface WeakSetConstructor {}

/************************************************
*                                               *
*                   GLOBAL                      *
*                                               *
************************************************/
declare var process: NodeJS.Process;
declare var global: NodeJS.Global;

declare var __filename: string;
declare var __dirname: string;

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearTimeout(timeoutId: NodeJS.Timer): void;
declare function setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
declare function clearInterval(intervalId: NodeJS.Timer): void;
declare function setImmediate(callback: (...args: any[]) => void, ...args: any[]): any;
declare function clearImmediate(immediateId: any): void;

interface NodeRequireFunction {
    (id: string): any;
}

interface NodeRequire extends NodeRequireFunction {
    resolve(id:string): string;
    cache: any;
    extensions: any;
    main: any;
}

declare var require: NodeRequire;

interface NodeModule {
    exports: any;
    require: NodeRequireFunction;
    id: string;
    filename: string;
    loaded: boolean;
    parent: any;
    children: any[];
}

declare var module: NodeModule;

// Same as module.exports
declare var exports: any;
declare var SlowBuffer: {
    new (str: string, encoding?: string): Buffer;
    new (size: number): Buffer;
    new (size: Uint8Array): Buffer;
    new (array: any[]): Buffer;
    prototype: Buffer;
    isBuffer(obj: any): boolean;
    byteLength(string: string, encoding?: string): number;
    concat(list: Buffer[], totalLength?: number): Buffer;
};


// Buffer class
interface Buffer extends NodeBuffer {}

/**
 * Raw data is stored in instances of the Buffer class.
 * A Buffer is similar to an array of integers but corresponds to a raw memory allocation outside the V8 heap.  A Buffer cannot be resized.
 * Valid string encodings: 'ascii'|'utf8'|'utf16le'|'ucs2'(alias of 'utf16le')|'base64'|'binary'(deprecated)|'hex'
 */
declare var Buffer: {
    /**
     * Allocates a new buffer containing the given {str}.
     *
     * @param str String to store in buffer.
     * @param encoding encoding to use, optional.  Default is 'utf8'
     */
    new (str: string, encoding?: string): Buffer;
    /**
     * Allocates a new buffer of {size} octets.
     *
     * @param size count of octets to allocate.
     */
    new (size: number): Buffer;
    /**
     * Allocates a new buffer containing the given {array} of octets.
     *
     * @param array The octets to store.
     */
    new (array: Uint8Array): Buffer;
    /**
     * Allocates a new buffer containing the given {array} of octets.
     *
     * @param array The octets to store.
     */
    new (array: any[]): Buffer;
    prototype: Buffer;
    /**
     * Returns true if {obj} is a Buffer
     *
     * @param obj object to test.
     */
    isBuffer(obj: any): boolean;
    /**
     * Returns true if {encoding} is a valid encoding argument.
     * Valid string encodings in Node 0.12: 'ascii'|'utf8'|'utf16le'|'ucs2'(alias of 'utf16le')|'base64'|'binary'(deprecated)|'hex'
     *
     * @param encoding string to test.
     */
    isEncoding(encoding: string): boolean;
    /**
     * Gives the actual byte length of a string. encoding defaults to 'utf8'.
     * This is not the same as String.prototype.length since that returns the number of characters in a string.
     *
     * @param string string to test.
     * @param encoding encoding used to evaluate (defaults to 'utf8')
     */
    byteLength(string: string, encoding?: string): number;
    /**
     * Returns a buffer which is the result of concatenating all the buffers in the list together.
     *
     * If the list has no items, or if the totalLength is 0, then it returns a zero-length buffer.
     * If the list has exactly one item, then the first item of the list is returned.
     * If the list has more than one item, then a new Buffer is created.
     *
     * @param list An array of Buffer objects to concatenate
     * @param totalLength Total length of the buffers when concatenated.
     *   If totalLength is not provided, it is read from the buffers in the list. However, this adds an additional loop to the function, so it is faster to provide the length explicitly.
     */
    concat(list: Buffer[], totalLength?: number): Buffer;
    /**
     * The same as buf1.compare(buf2).
     */
    compare(buf1: Buffer, buf2: Buffer): number;
};

/************************************************
*                                               *
*               GLOBAL INTERFACES               *
*                                               *
************************************************/
declare module NodeJS {
    export interface ErrnoException extends Error {
        errno?: number;
        code?: string;
        path?: string;
        syscall?: string;
        stack?: string;
    }

    export interface EventEmitter {
        addListener(event: string, listener: Function): EventEmitter;
        on(event: string, listener: Function): EventEmitter;
        once(event: string, listener: Function): EventEmitter;
        removeListener(event: string, listener: Function): EventEmitter;
        removeAllListeners(event?: string): EventEmitter;
        setMaxListeners(n: number): void;
        listeners(event: string): Function[];
        emit(event: string, ...args: any[]): boolean;
    }

    export interface ReadableStream extends EventEmitter {
        readable: boolean;
        read(size?: number): string|Buffer;
        setEncoding(encoding: string): void;
        pause(): void;
        resume(): void;
        pipe<T extends WritableStream>(destination: T, options?: { end?: boolean; }): T;
        unpipe<T extends WritableStream>(destination?: T): void;
        unshift(chunk: string): void;
        unshift(chunk: Buffer): void;
        wrap(oldStream: ReadableStream): ReadableStream;
    }

    export interface WritableStream extends EventEmitter {
        writable: boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
    }

    export interface ReadWriteStream extends ReadableStream, WritableStream {}

    export interface Process extends EventEmitter {
        stdout: WritableStream;
        stderr: WritableStream;
        stdin: ReadableStream;
        argv: string[];
        execPath: string;
        abort(): void;
        chdir(directory: string): void;
        cwd(): string;
        env: any;
        exit(code?: number): void;
        getgid(): number;
        setgid(id: number): void;
        setgid(id: string): void;
        getuid(): number;
        setuid(id: number): void;
        setuid(id: string): void;
        version: string;
        versions: {
            http_parser: string;
            node: string;
            v8: string;
            ares: string;
            uv: string;
            zlib: string;
            openssl: string;
        };
        config: {
            target_defaults: {
                cflags: any[];
                default_configuration: string;
                defines: string[];
                include_dirs: string[];
                libraries: string[];
            };
            variables: {
                clang: number;
                host_arch: string;
                node_install_npm: boolean;
                node_install_waf: boolean;
                node_prefix: string;
                node_shared_openssl: boolean;
                node_shared_v8: boolean;
                node_shared_zlib: boolean;
                node_use_dtrace: boolean;
                node_use_etw: boolean;
                node_use_openssl: boolean;
                target_arch: string;
                v8_no_strict_aliasing: number;
                v8_use_snapshot: boolean;
                visibility: string;
            };
        };
        kill(pid: number, signal?: string): void;
        pid: number;
        title: string;
        arch: string;
        platform: string;
        memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; };
        nextTick(callback: Function): void;
        umask(mask?: number): number;
        uptime(): number;
        hrtime(time?:number[]): number[];

        // Worker
        send?(message: any, sendHandle?: any): void;
    }

    export interface Global {
        Array: typeof Array;
        ArrayBuffer: typeof ArrayBuffer;
        Boolean: typeof Boolean;
        Buffer: typeof Buffer;
        DataView: typeof DataView;
        Date: typeof Date;
        Error: typeof Error;
        EvalError: typeof EvalError;
        Float32Array: typeof Float32Array;
        Float64Array: typeof Float64Array;
        Function: typeof Function;
        GLOBAL: Global;
        Infinity: typeof Infinity;
        Int16Array: typeof Int16Array;
        Int32Array: typeof Int32Array;
        Int8Array: typeof Int8Array;
        Intl: typeof Intl;
        JSON: typeof JSON;
        Map: MapConstructor;
        Math: typeof Math;
        NaN: typeof NaN;
        Number: typeof Number;
        Object: typeof Object;
        Promise: Function;
        RangeError: typeof RangeError;
        ReferenceError: typeof ReferenceError;
        RegExp: typeof RegExp;
        Set: SetConstructor;
        String: typeof String;
        Symbol: Function;
        SyntaxError: typeof SyntaxError;
        TypeError: typeof TypeError;
        URIError: typeof URIError;
        Uint16Array: typeof Uint16Array;
        Uint32Array: typeof Uint32Array;
        Uint8Array: typeof Uint8Array;
        Uint8ClampedArray: Function;
        WeakMap: WeakMapConstructor;
        WeakSet: WeakSetConstructor;
        clearImmediate: (immediateId: any) => void;
        clearInterval: (intervalId: NodeJS.Timer) => void;
        clearTimeout: (timeoutId: NodeJS.Timer) => void;
        console: typeof console;
        decodeURI: typeof decodeURI;
        decodeURIComponent: typeof decodeURIComponent;
        encodeURI: typeof encodeURI;
        encodeURIComponent: typeof encodeURIComponent;
        escape: (str: string) => string;
        eval: typeof eval;
        global: Global;
        isFinite: typeof isFinite;
        isNaN: typeof isNaN;
        parseFloat: typeof parseFloat;
        parseInt: typeof parseInt;
        process: Process;
        root: Global;
        setImmediate: (callback: (...args: any[]) => void, ...args: any[]) => any;
        setInterval: (callback: (...args: any[]) => void, ms: number, ...args: any[]) => NodeJS.Timer;
        setTimeout: (callback: (...args: any[]) => void, ms: number, ...args: any[]) => NodeJS.Timer;
        undefined: typeof undefined;
        unescape: (str: string) => string;
        gc: () => void;
    }

    export interface Timer {
        ref() : void;
        unref() : void;
    }
}

/**
 * @deprecated
 */
interface NodeBuffer {
    [index: number]: number;
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    toString(encoding?: string, start?: number, end?: number): string;
    toJSON(): any;
    length: number;
    equals(otherBuffer: Buffer): boolean;
    compare(otherBuffer: Buffer): number;
    copy(targetBuffer: Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    slice(start?: number, end?: number): Buffer;
    writeUIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeUIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    writeIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
    readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
    readIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
    readUInt8(offset: number, noAsset?: boolean): number;
    readUInt16LE(offset: number, noAssert?: boolean): number;
    readUInt16BE(offset: number, noAssert?: boolean): number;
    readUInt32LE(offset: number, noAssert?: boolean): number;
    readUInt32BE(offset: number, noAssert?: boolean): number;
    readInt8(offset: number, noAssert?: boolean): number;
    readInt16LE(offset: number, noAssert?: boolean): number;
    readInt16BE(offset: number, noAssert?: boolean): number;
    readInt32LE(offset: number, noAssert?: boolean): number;
    readInt32BE(offset: number, noAssert?: boolean): number;
    readFloatLE(offset: number, noAssert?: boolean): number;
    readFloatBE(offset: number, noAssert?: boolean): number;
    readDoubleLE(offset: number, noAssert?: boolean): number;
    readDoubleBE(offset: number, noAssert?: boolean): number;
    writeUInt8(value: number, offset: number, noAssert?: boolean): void;
    writeUInt16LE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt16BE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt32LE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt32BE(value: number, offset: number, noAssert?: boolean): void;
    writeInt8(value: number, offset: number, noAssert?: boolean): void;
    writeInt16LE(value: number, offset: number, noAssert?: boolean): void;
    writeInt16BE(value: number, offset: number, noAssert?: boolean): void;
    writeInt32LE(value: number, offset: number, noAssert?: boolean): void;
    writeInt32BE(value: number, offset: number, noAssert?: boolean): void;
    writeFloatLE(value: number, offset: number, noAssert?: boolean): void;
    writeFloatBE(value: number, offset: number, noAssert?: boolean): void;
    writeDoubleLE(value: number, offset: number, noAssert?: boolean): void;
    writeDoubleBE(value: number, offset: number, noAssert?: boolean): void;
    fill(value: any, offset?: number, end?: number): void;
}

/************************************************
*                                               *
*                   MODULES                     *
*                                               *
************************************************/
declare module "buffer" {
    export var INSPECT_MAX_BYTES: number;
}

declare module "querystring" {
    export function stringify(obj: any, sep?: string, eq?: string): string;
    export function parse(str: string, sep?: string, eq?: string, options?: { maxKeys?: number; }): any;
    export function escape(str: string): string;
    export function unescape(str: string): string;
}

declare module "events" {
    export class EventEmitter implements NodeJS.EventEmitter {
        static listenerCount(emitter: EventEmitter, event: string): number;

        addListener(event: string, listener: Function): EventEmitter;
        on(event: string, listener: Function): EventEmitter;
        once(event: string, listener: Function): EventEmitter;
        removeListener(event: string, listener: Function): EventEmitter;
        removeAllListeners(event?: string): EventEmitter;
        setMaxListeners(n: number): void;
        listeners(event: string): Function[];
        emit(event: string, ...args: any[]): boolean;
   }
}

declare module "http" {
    import * as events from "events";
    import * as net from "net";
    import * as stream from "stream";

    export interface Server extends events.EventEmitter {
        listen(port: number, hostname?: string, backlog?: number, callback?: Function): Server;
        listen(port: number, hostname?: string, callback?: Function): Server;
        listen(path: string, callback?: Function): Server;
        listen(handle: any, listeningListener?: Function): Server;
        close(cb?: any): Server;
        address(): { port: number; family: string; address: string; };
        maxHeadersCount: number;
    }
    /**
     * @deprecated Use IncomingMessage
     */
    export interface ServerRequest extends IncomingMessage {
        connection: net.Socket;
    }
    export interface ServerResponse extends events.EventEmitter, stream.Writable {
        // Extended base methods
        write(buffer: Buffer): boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        write(str: string, encoding?: string, fd?: string): boolean;

        writeContinue(): void;
        writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void;
        writeHead(statusCode: number, headers?: any): void;
        statusCode: number;
        statusMessage: string;
        setHeader(name: string, value: string): void;
        sendDate: boolean;
        getHeader(name: string): string;
        removeHeader(name: string): void;
        write(chunk: any, encoding?: string): any;
        addTrailers(headers: any): void;

        // Extended base methods
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
        end(data?: any, encoding?: string): void;
    }
    export interface ClientRequest extends events.EventEmitter, stream.Writable {
        // Extended base methods
        write(buffer: Buffer): boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        write(str: string, encoding?: string, fd?: string): boolean;

        write(chunk: any, encoding?: string): void;
        abort(): void;
        setTimeout(timeout: number, callback?: Function): void;
        setNoDelay(noDelay?: boolean): void;
        setSocketKeepAlive(enable?: boolean, initialDelay?: number): void;

        // Extended base methods
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
        end(data?: any, encoding?: string): void;
    }
    export interface IncomingMessage extends events.EventEmitter, stream.Readable {
        httpVersion: string;
        headers: any;
        rawHeaders: string[];
        trailers: any;
        rawTrailers: any;
        setTimeout(msecs: number, callback: Function): NodeJS.Timer;
        /**
         * Only valid for request obtained from http.Server.
         */
        method?: string;
        /**
         * Only valid for request obtained from http.Server.
         */
        url?: string;
        /**
         * Only valid for response obtained from http.ClientRequest.
         */
        statusCode?: number;
        /**
         * Only valid for response obtained from http.ClientRequest.
         */
        statusMessage?: string;
        socket: net.Socket;
    }
    /**
     * @deprecated Use IncomingMessage
     */
    export interface ClientResponse extends IncomingMessage { }

	export interface AgentOptions {
		/**
		 * Keep sockets around in a pool to be used by other requests in the future. Default = false
		 */
		keepAlive?: boolean;
		/**
		 * When using HTTP KeepAlive, how often to send TCP KeepAlive packets over sockets being kept alive. Default = 1000.
		 * Only relevant if keepAlive is set to true.
		 */
		keepAliveMsecs?: number;
		/**
		 * Maximum number of sockets to allow per host. Default for Node 0.10 is 5, default for Node 0.12 is Infinity
		 */
		maxSockets?: number;
		/**
		 * Maximum number of sockets to leave open in a free state. Only relevant if keepAlive is set to true. Default = 256.
		 */
		maxFreeSockets?: number;
	}

    export class Agent {
		maxSockets: number;
		sockets: any;
		requests: any;

		constructor(opts?: AgentOptions);

		/**
		 * Destroy any sockets that are currently in use by the agent.
		 * It is usually not necessary to do this. However, if you are using an agent with KeepAlive enabled,
		 * then it is best to explicitly shut down the agent when you know that it will no longer be used. Otherwise,
		 * sockets may hang open for quite a long time before the server terminates them.
		 */
		destroy(): void;
	}

    export var METHODS: string[];

    export var STATUS_CODES: {
        [errorCode: number]: string;
        [errorCode: string]: string;
    };
    export function createServer(requestListener?: (request: IncomingMessage, response: ServerResponse) =>void ): Server;
    export function createClient(port?: number, host?: string): any;
    export function request(options: any, callback?: (res: IncomingMessage) => void): ClientRequest;
    export function get(options: any, callback?: (res: IncomingMessage) => void): ClientRequest;
    export var globalAgent: Agent;
}

declare module "cluster" {
    import * as child from "child_process";
    import * as events from "events";

    export interface ClusterSettings {
        exec?: string;
        args?: string[];
        silent?: boolean;
    }

    export class Worker extends events.EventEmitter {
        id: string;
        process: child.ChildProcess;
        suicide: boolean;
        send(message: any, sendHandle?: any): void;
        kill(signal?: string): void;
        destroy(signal?: string): void;
        disconnect(): void;
    }

    export var settings: ClusterSettings;
    export var isMaster: boolean;
    export var isWorker: boolean;
    export function setupMaster(settings?: ClusterSettings): void;
    export function fork(env?: any): Worker;
    export function disconnect(callback?: Function): void;
    export var worker: Worker;
    export var workers: Worker[];

    // Event emitter
    export function addListener(event: string, listener: Function): void;
    export function on(event: string, listener: Function): any;
    export function once(event: string, listener: Function): void;
    export function removeListener(event: string, listener: Function): void;
    export function removeAllListeners(event?: string): void;
    export function setMaxListeners(n: number): void;
    export function listeners(event: string): Function[];
    export function emit(event: string, ...args: any[]): boolean;
}

declare module "zlib" {
    import * as stream from "stream";
    export interface ZlibOptions { chunkSize?: number; windowBits?: number; level?: number; memLevel?: number; strategy?: number; dictionary?: any; }

    export interface Gzip extends stream.Transform { }
    export interface Gunzip extends stream.Transform { }
    export interface Deflate extends stream.Transform { }
    export interface Inflate extends stream.Transform { }
    export interface DeflateRaw extends stream.Transform { }
    export interface InflateRaw extends stream.Transform { }
    export interface Unzip extends stream.Transform { }

    export function createGzip(options?: ZlibOptions): Gzip;
    export function createGunzip(options?: ZlibOptions): Gunzip;
    export function createDeflate(options?: ZlibOptions): Deflate;
    export function createInflate(options?: ZlibOptions): Inflate;
    export function createDeflateRaw(options?: ZlibOptions): DeflateRaw;
    export function createInflateRaw(options?: ZlibOptions): InflateRaw;
    export function createUnzip(options?: ZlibOptions): Unzip;

    export function deflate(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function deflateSync(buf: Buffer, options?: ZlibOptions): any;
    export function deflateRaw(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function deflateRawSync(buf: Buffer, options?: ZlibOptions): any;
    export function gzip(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function gzipSync(buf: Buffer, options?: ZlibOptions): any;
    export function gunzip(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function gunzipSync(buf: Buffer, options?: ZlibOptions): any;
    export function inflate(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function inflateSync(buf: Buffer, options?: ZlibOptions): any;
    export function inflateRaw(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function inflateRawSync(buf: Buffer, options?: ZlibOptions): any;
    export function unzip(buf: Buffer, callback: (error: Error, result: any) =>void ): void;
    export function unzipSync(buf: Buffer, options?: ZlibOptions): any;

    // Constants
    export var Z_NO_FLUSH: number;
    export var Z_PARTIAL_FLUSH: number;
    export var Z_SYNC_FLUSH: number;
    export var Z_FULL_FLUSH: number;
    export var Z_FINISH: number;
    export var Z_BLOCK: number;
    export var Z_TREES: number;
    export var Z_OK: number;
    export var Z_STREAM_END: number;
    export var Z_NEED_DICT: number;
    export var Z_ERRNO: number;
    export var Z_STREAM_ERROR: number;
    export var Z_DATA_ERROR: number;
    export var Z_MEM_ERROR: number;
    export var Z_BUF_ERROR: number;
    export var Z_VERSION_ERROR: number;
    export var Z_NO_COMPRESSION: number;
    export var Z_BEST_SPEED: number;
    export var Z_BEST_COMPRESSION: number;
    export var Z_DEFAULT_COMPRESSION: number;
    export var Z_FILTERED: number;
    export var Z_HUFFMAN_ONLY: number;
    export var Z_RLE: number;
    export var Z_FIXED: number;
    export var Z_DEFAULT_STRATEGY: number;
    export var Z_BINARY: number;
    export var Z_TEXT: number;
    export var Z_ASCII: number;
    export var Z_UNKNOWN: number;
    export var Z_DEFLATED: number;
    export var Z_NULL: number;
}

declare module "os" {
    export function tmpdir(): string;
    export function hostname(): string;
    export function type(): string;
    export function platform(): string;
    export function arch(): string;
    export function release(): string;
    export function uptime(): number;
    export function loadavg(): number[];
    export function totalmem(): number;
    export function freemem(): number;
    export function cpus(): { model: string; speed: number; times: { user: number; nice: number; sys: number; idle: number; irq: number; }; }[];
    export function networkInterfaces(): any;
    export var EOL: string;
}

declare module "https" {
    import * as tls from "tls";
    import * as events from "events";
    import * as http from "http";

    export interface ServerOptions {
        pfx?: any;
        key?: any;
        passphrase?: string;
        cert?: any;
        ca?: any;
        crl?: any;
        ciphers?: string;
        honorCipherOrder?: boolean;
        requestCert?: boolean;
        rejectUnauthorized?: boolean;
        NPNProtocols?: any;
        SNICallback?: (servername: string) => any;
    }

    export interface RequestOptions {
        host?: string;
        hostname?: string;
        port?: number;
        path?: string;
        method?: string;
        headers?: any;
        auth?: string;
        agent?: any;
        pfx?: any;
        key?: any;
        passphrase?: string;
        cert?: any;
        ca?: any;
        ciphers?: string;
        rejectUnauthorized?: boolean;
    }

    export interface Agent {
        maxSockets: number;
        sockets: any;
        requests: any;
    }
    export var Agent: {
        new (options?: RequestOptions): Agent;
    };
    export interface Server extends tls.Server { }
    export function createServer(options: ServerOptions, requestListener?: Function): Server;
    export function request(options: RequestOptions, callback?: (res: http.IncomingMessage) =>void ): http.ClientRequest;
    export function get(options: RequestOptions, callback?: (res: http.IncomingMessage) =>void ): http.ClientRequest;
    export var globalAgent: Agent;
}

declare module "punycode" {
    export function decode(string: string): string;
    export function encode(string: string): string;
    export function toUnicode(domain: string): string;
    export function toASCII(domain: string): string;
    export var ucs2: ucs2;
    interface ucs2 {
        decode(string: string): string;
        encode(codePoints: number[]): string;
    }
    export var version: any;
}

declare module "repl" {
    import * as stream from "stream";
    import * as events from "events";

    export interface ReplOptions {
        prompt?: string;
        input?: NodeJS.ReadableStream;
        output?: NodeJS.WritableStream;
        terminal?: boolean;
        eval?: Function;
        useColors?: boolean;
        useGlobal?: boolean;
        ignoreUndefined?: boolean;
        writer?: Function;
    }
    export function start(options: ReplOptions): events.EventEmitter;
}

declare module "readline" {
    import * as events from "events";
    import * as stream from "stream";

    export interface ReadLine extends events.EventEmitter {
        setPrompt(prompt: string): void;
        prompt(preserveCursor?: boolean): void;
        question(query: string, callback: Function): void;
        pause(): void;
        resume(): void;
        close(): void;
        write(data: any, key?: any): void;
    }
    export interface ReadLineOptions {
        input: NodeJS.ReadableStream;
        output: NodeJS.WritableStream;
        completer?: Function;
        terminal?: boolean;
    }
    export function createInterface(options: ReadLineOptions): ReadLine;
}

declare module "vm" {
    export interface Context { }
    export interface Script {
        runInThisContext(): void;
        runInNewContext(sandbox?: Context): void;
    }
    export function runInThisContext(code: string, filename?: string): void;
    export function runInNewContext(code: string, sandbox?: Context, filename?: string): void;
    export function runInContext(code: string, context: Context, filename?: string): void;
    export function createContext(initSandbox?: Context): Context;
    export function createScript(code: string, filename?: string): Script;
}

declare module "child_process" {
    import * as events from "events";
    import * as stream from "stream";

    export interface ChildProcess extends events.EventEmitter {
        stdin:  stream.Writable;
        stdout: stream.Readable;
        stderr: stream.Readable;
        pid: number;
        kill(signal?: string): void;
        send(message: any, sendHandle?: any): void;
        disconnect(): void;
        unref(): void;
    }

    export function spawn(command: string, args?: string[], options?: {
        cwd?: string;
        stdio?: any;
        custom?: any;
        env?: any;
        detached?: boolean;
    }): ChildProcess;
    export function exec(command: string, options: {
        cwd?: string;
        stdio?: any;
        customFds?: any;
        env?: any;
        encoding?: string;
        timeout?: number;
        maxBuffer?: number;
        killSignal?: string;
    }, callback?: (error: Error, stdout: Buffer, stderr: Buffer) =>void ): ChildProcess;
    export function exec(command: string, callback?: (error: Error, stdout: Buffer, stderr: Buffer) =>void ): ChildProcess;
    export function execFile(file: string,
        callback?: (error: Error, stdout: Buffer, stderr: Buffer) =>void ): ChildProcess;
    export function execFile(file: string, args?: string[],
        callback?: (error: Error, stdout: Buffer, stderr: Buffer) =>void ): ChildProcess;
    export function execFile(file: string, args?: string[], options?: {
        cwd?: string;
        stdio?: any;
        customFds?: any;
        env?: any;
        encoding?: string;
        timeout?: number;
        maxBuffer?: string;
        killSignal?: string;
    }, callback?: (error: Error, stdout: Buffer, stderr: Buffer) =>void ): ChildProcess;
    export function fork(modulePath: string, args?: string[], options?: {
        cwd?: string;
        env?: any;
        encoding?: string;
    }): ChildProcess;
    export function execSync(command: string, options?: {
        cwd?: string;
        input?: string|Buffer;
        stdio?: any;
        env?: any;
        uid?: number;
        gid?: number;
        timeout?: number;
        maxBuffer?: number;
        killSignal?: string;
        encoding?: string;
    }): ChildProcess;
    export function execFileSync(command: string, args?: string[], options?: {
        cwd?: string;
        input?: string|Buffer;
        stdio?: any;
        env?: any;
        uid?: number;
        gid?: number;
        timeout?: number;
        maxBuffer?: number;
        killSignal?: string;
        encoding?: string;
    }): ChildProcess;
}

declare module "url" {
    export interface Url {
        href: string;
        protocol: string;
        auth: string;
        hostname: string;
        port: string;
        host: string;
        pathname: string;
        search: string;
        query: any; // string | Object
        slashes: boolean;
        hash?: string;
        path?: string;
    }

    export interface UrlOptions {
        protocol?: string;
        auth?: string;
        hostname?: string;
        port?: string;
        host?: string;
        pathname?: string;
        search?: string;
        query?: any;
        hash?: string;
        path?: string;
    }

    export function parse(urlStr: string, parseQueryString?: boolean , slashesDenoteHost?: boolean ): Url;
    export function format(url: UrlOptions): string;
    export function resolve(from: string, to: string): string;
}

declare module "dns" {
    export function lookup(domain: string, family: number, callback: (err: Error, address: string, family: number) =>void ): string;
    export function lookup(domain: string, callback: (err: Error, address: string, family: number) =>void ): string;
    export function resolve(domain: string, rrtype: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolve(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolve4(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolve6(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolveMx(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolveTxt(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolveSrv(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolveNs(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function resolveCname(domain: string, callback: (err: Error, addresses: string[]) =>void ): string[];
    export function reverse(ip: string, callback: (err: Error, domains: string[]) =>void ): string[];
}

declare module "net" {
    import * as stream from "stream";

    export interface Socket extends stream.Duplex {
        // Extended base methods
        write(buffer: Buffer): boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        write(str: string, encoding?: string, fd?: string): boolean;

        connect(port: number, host?: string, connectionListener?: Function): void;
        connect(path: string, connectionListener?: Function): void;
        bufferSize: number;
        setEncoding(encoding?: string): void;
        write(data: any, encoding?: string, callback?: Function): void;
        destroy(): void;
        pause(): void;
        resume(): void;
        setTimeout(timeout: number, callback?: Function): void;
        setNoDelay(noDelay?: boolean): void;
        setKeepAlive(enable?: boolean, initialDelay?: number): void;
        address(): { port: number; family: string; address: string; };
        unref(): void;
        ref(): void;

        remoteAddress: string;
        remoteFamily: string;
        remotePort: number;
        localAddress: string;
        localPort: number;
        bytesRead: number;
        bytesWritten: number;

        // Extended base methods
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
        end(data?: any, encoding?: string): void;
    }

    export var Socket: {
        new (options?: { fd?: string; type?: string; allowHalfOpen?: boolean; }): Socket;
    };

    export interface Server extends Socket {
        listen(port: number, host?: string, backlog?: number, listeningListener?: Function): Server;
        listen(path: string, listeningListener?: Function): Server;
        listen(handle: any, listeningListener?: Function): Server;
        close(callback?: Function): Server;
        address(): { port: number; family: string; address: string; };
        maxConnections: number;
        connections: number;
    }
    export function createServer(connectionListener?: (socket: Socket) =>void ): Server;
    export function createServer(options?: { allowHalfOpen?: boolean; }, connectionListener?: (socket: Socket) =>void ): Server;
    export function connect(options: { allowHalfOpen?: boolean; }, connectionListener?: Function): Socket;
    export function connect(port: number, host?: string, connectionListener?: Function): Socket;
    export function connect(path: string, connectionListener?: Function): Socket;
    export function createConnection(options: { allowHalfOpen?: boolean; }, connectionListener?: Function): Socket;
    export function createConnection(port: number, host?: string, connectionListener?: Function): Socket;
    export function createConnection(path: string, connectionListener?: Function): Socket;
    export function isIP(input: string): number;
    export function isIPv4(input: string): boolean;
    export function isIPv6(input: string): boolean;
}

declare module "dgram" {
    import * as events from "events";

    interface RemoteInfo {
        address: string;
        port: number;
        size: number;
    }

    interface AddressInfo {
        address: string;
        family: string;
        port: number;
    }

    export function createSocket(type: string, callback?: (msg: Buffer, rinfo: RemoteInfo) => void): Socket;

    interface Socket extends events.EventEmitter {
        send(buf: Buffer, offset: number, length: number, port: number, address: string, callback?: (error: Error, bytes: number) => void): void;
        bind(port: number, address?: string, callback?: () => void): void;
        close(): void;
        address(): AddressInfo;
        setBroadcast(flag: boolean): void;
        setMulticastTTL(ttl: number): void;
        setMulticastLoopback(flag: boolean): void;
        addMembership(multicastAddress: string, multicastInterface?: string): void;
        dropMembership(multicastAddress: string, multicastInterface?: string): void;
    }
}

declare module "fs" {
    import * as stream from "stream";
    import * as events from "events";

    interface Stats {
        isFile(): boolean;
        isDirectory(): boolean;
        isBlockDevice(): boolean;
        isCharacterDevice(): boolean;
        isSymbolicLink(): boolean;
        isFIFO(): boolean;
        isSocket(): boolean;
        dev: number;
        ino: number;
        mode: number;
        nlink: number;
        uid: number;
        gid: number;
        rdev: number;
        size: number;
        blksize: number;
        blocks: number;
        atime: Date;
        mtime: Date;
        ctime: Date;
    }

    interface FSWatcher extends events.EventEmitter {
        close(): void;
    }

    export interface ReadStream extends stream.Readable {
        close(): void;
    }
    export interface WriteStream extends stream.Writable {
        close(): void;
        bytesWritten: number;
    }

    /**
     * Asynchronous rename.
     * @param oldPath
     * @param newPath
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function rename(oldPath: string, newPath: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /**
     * Synchronous rename
     * @param oldPath
     * @param newPath
     */
    export function renameSync(oldPath: string, newPath: string): void;
    export function truncate(path: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function truncate(path: string, len: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function truncateSync(path: string, len?: number): void;
    export function ftruncate(fd: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function ftruncate(fd: number, len: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function ftruncateSync(fd: number, len?: number): void;
    export function chown(path: string, uid: number, gid: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function chownSync(path: string, uid: number, gid: number): void;
    export function fchown(fd: number, uid: number, gid: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function fchownSync(fd: number, uid: number, gid: number): void;
    export function lchown(path: string, uid: number, gid: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function lchownSync(path: string, uid: number, gid: number): void;
    export function chmod(path: string, mode: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function chmod(path: string, mode: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function chmodSync(path: string, mode: number): void;
    export function chmodSync(path: string, mode: string): void;
    export function fchmod(fd: number, mode: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function fchmod(fd: number, mode: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function fchmodSync(fd: number, mode: number): void;
    export function fchmodSync(fd: number, mode: string): void;
    export function lchmod(path: string, mode: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function lchmod(path: string, mode: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function lchmodSync(path: string, mode: number): void;
    export function lchmodSync(path: string, mode: string): void;
    export function stat(path: string, callback?: (err: NodeJS.ErrnoException, stats: Stats) => any): void;
    export function lstat(path: string, callback?: (err: NodeJS.ErrnoException, stats: Stats) => any): void;
    export function fstat(fd: number, callback?: (err: NodeJS.ErrnoException, stats: Stats) => any): void;
    export function statSync(path: string): Stats;
    export function lstatSync(path: string): Stats;
    export function fstatSync(fd: number): Stats;
    export function link(srcpath: string, dstpath: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function linkSync(srcpath: string, dstpath: string): void;
    export function symlink(srcpath: string, dstpath: string, type?: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function symlinkSync(srcpath: string, dstpath: string, type?: string): void;
    export function readlink(path: string, callback?: (err: NodeJS.ErrnoException, linkString: string) => any): void;
    export function readlinkSync(path: string): string;
    export function realpath(path: string, callback?: (err: NodeJS.ErrnoException, resolvedPath: string) => any): void;
    export function realpath(path: string, cache: {[path: string]: string}, callback: (err: NodeJS.ErrnoException, resolvedPath: string) =>any): void;
    export function realpathSync(path: string, cache?: { [path: string]: string }): string;
    /*
     * Asynchronous unlink - deletes the file specified in {path}
     *
     * @param path
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function unlink(path: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /*
     * Synchronous unlink - deletes the file specified in {path}
     *
     * @param path
     */
    export function unlinkSync(path: string): void;
    /*
     * Asynchronous rmdir - removes the directory specified in {path}
     *
     * @param path
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function rmdir(path: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /*
     * Synchronous rmdir - removes the directory specified in {path}
     *
     * @param path
     */
    export function rmdirSync(path: string): void;
    /*
     * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function mkdir(path: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /*
     * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     * @param mode
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function mkdir(path: string, mode: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /*
     * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     * @param mode
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function mkdir(path: string, mode: string, callback?: (err?: NodeJS.ErrnoException) => void): void;
    /*
     * Synchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     * @param mode
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function mkdirSync(path: string, mode?: number): void;
    /*
     * Synchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     * @param mode
     * @param callback No arguments other than a possible exception are given to the completion callback.
     */
    export function mkdirSync(path: string, mode?: string): void;
    export function readdir(path: string, callback?: (err: NodeJS.ErrnoException, files: string[]) => void): void;
    export function readdirSync(path: string): string[];
    export function close(fd: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function closeSync(fd: number): void;
    export function open(path: string, flags: string, callback?: (err: NodeJS.ErrnoException, fd: number) => any): void;
    export function open(path: string, flags: string, mode: number, callback?: (err: NodeJS.ErrnoException, fd: number) => any): void;
    export function open(path: string, flags: string, mode: string, callback?: (err: NodeJS.ErrnoException, fd: number) => any): void;
    export function openSync(path: string, flags: string, mode?: number): number;
    export function openSync(path: string, flags: string, mode?: string): number;
    export function utimes(path: string, atime: number, mtime: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function utimes(path: string, atime: Date, mtime: Date, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function utimesSync(path: string, atime: number, mtime: number): void;
    export function utimesSync(path: string, atime: Date, mtime: Date): void;
    export function futimes(fd: number, atime: number, mtime: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function futimes(fd: number, atime: Date, mtime: Date, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function futimesSync(fd: number, atime: number, mtime: number): void;
    export function futimesSync(fd: number, atime: Date, mtime: Date): void;
    export function fsync(fd: number, callback?: (err?: NodeJS.ErrnoException) => void): void;
    export function fsyncSync(fd: number): void;
    export function write(fd: number, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: NodeJS.ErrnoException, written: number, buffer: Buffer) => void): void;
    export function write(fd: number, buffer: Buffer, offset: number, length: number, callback?: (err: NodeJS.ErrnoException, written: number, buffer: Buffer) => void): void;
    export function writeSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
    export function read(fd: number, buffer: Buffer, offset: number, length: number, position: number, callback?: (err: NodeJS.ErrnoException, bytesRead: number, buffer: Buffer) => void): void;
    export function readSync(fd: number, buffer: Buffer, offset: number, length: number, position: number): number;
    /*
     * Asynchronous readFile - Asynchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param encoding
     * @param callback - The callback is passed two arguments (err, data), where data is the contents of the file.
     */
    export function readFile(filename: string, encoding: string, callback: (err: NodeJS.ErrnoException, data: string) => void): void;
    /*
     * Asynchronous readFile - Asynchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param options An object with optional {encoding} and {flag} properties.  If {encoding} is specified, readFile returns a string; otherwise it returns a Buffer.
     * @param callback - The callback is passed two arguments (err, data), where data is the contents of the file.
     */
    export function readFile(filename: string, options: { encoding: string; flag?: string; }, callback: (err: NodeJS.ErrnoException, data: string) => void): void;
    /*
     * Asynchronous readFile - Asynchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param options An object with optional {encoding} and {flag} properties.  If {encoding} is specified, readFile returns a string; otherwise it returns a Buffer.
     * @param callback - The callback is passed two arguments (err, data), where data is the contents of the file.
     */
    export function readFile(filename: string, options: { flag?: string; }, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;
    /*
     * Asynchronous readFile - Asynchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param callback - The callback is passed two arguments (err, data), where data is the contents of the file.
     */
    export function readFile(filename: string, callback: (err: NodeJS.ErrnoException, data: Buffer) => void): void;
    /*
     * Synchronous readFile - Synchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param encoding
     */
    export function readFileSync(filename: string, encoding: string): string;
    /*
     * Synchronous readFile - Synchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param options An object with optional {encoding} and {flag} properties.  If {encoding} is specified, readFileSync returns a string; otherwise it returns a Buffer.
     */
    export function readFileSync(filename: string, options: { encoding: string; flag?: string; }): string;
    /*
     * Synchronous readFile - Synchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param options An object with optional {encoding} and {flag} properties.  If {encoding} is specified, readFileSync returns a string; otherwise it returns a Buffer.
     */
    export function readFileSync(filename: string, options?: { flag?: string; }): Buffer;
    export function writeFile(filename: string, data: any, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function writeFile(filename: string, data: any, options: { encoding?: string; mode?: number; flag?: string; }, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function writeFile(filename: string, data: any, options: { encoding?: string; mode?: string; flag?: string; }, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }): void;
    export function writeFileSync(filename: string, data: any, options?: { encoding?: string; mode?: string; flag?: string; }): void;
    export function appendFile(filename: string, data: any, options: { encoding?: string; mode?: number; flag?: string; }, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function appendFile(filename: string, data: any, options: { encoding?: string; mode?: string; flag?: string; }, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function appendFile(filename: string, data: any, callback?: (err: NodeJS.ErrnoException) => void): void;
    export function appendFileSync(filename: string, data: any, options?: { encoding?: string; mode?: number; flag?: string; }): void;
    export function appendFileSync(filename: string, data: any, options?: { encoding?: string; mode?: string; flag?: string; }): void;
    export function watchFile(filename: string, listener: (curr: Stats, prev: Stats) => void): void;
    export function watchFile(filename: string, options: { persistent?: boolean; interval?: number; }, listener: (curr: Stats, prev: Stats) => void): void;
    export function unwatchFile(filename: string, listener?: (curr: Stats, prev: Stats) => void): void;
    export function watch(filename: string, listener?: (event: string, filename: string) => any): FSWatcher;
    export function watch(filename: string, options: { persistent?: boolean; }, listener?: (event: string, filename: string) => any): FSWatcher;
    export function exists(path: string, callback?: (exists: boolean) => void): void;
    export function existsSync(path: string): boolean;
    /** Constant for fs.access(). File is visible to the calling process. */
    export var F_OK: number;
    /** Constant for fs.access(). File can be read by the calling process. */
    export var R_OK: number;
    /** Constant for fs.access(). File can be written by the calling process. */
    export var W_OK: number;
    /** Constant for fs.access(). File can be executed by the calling process. */
    export var X_OK: number;
    /** Tests a user's permissions for the file specified by path. */
    export function access(path: string, callback: (err: NodeJS.ErrnoException) => void): void;
    export function access(path: string, mode: number, callback: (err: NodeJS.ErrnoException) => void): void;
    /** Synchronous version of fs.access. This throws if any accessibility checks fail, and does nothing otherwise. */
    export function accessSync(path: string, mode ?: number): void;
    export function createReadStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: string;
        mode?: number;
        bufferSize?: number;
    }): ReadStream;
    export function createReadStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: string;
        mode?: string;
        bufferSize?: number;
    }): ReadStream;
    export function createWriteStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        string?: string;
    }): WriteStream;
}

declare module "path" {

    /**
     * A parsed path object generated by path.parse() or consumed by path.format().
     */
    export interface ParsedPath {
        /**
         * The root of the path such as '/' or 'c:\'
         */
        root: string;
        /**
         * The full directory path such as '/home/user/dir' or 'c:\path\dir'
         */
        dir: string;
        /**
         * The file name including extension (if any) such as 'index.html'
         */
        base: string;
        /**
         * The file extension (if any) such as '.html'
         */
        ext: string;
        /**
         * The file name without extension (if any) such as 'index'
         */
        name: string;
    }

    /**
     * Normalize a string path, reducing '..' and '.' parts.
     * When multiple slashes are found, they're replaced by a single one; when the path contains a trailing slash, it is preserved. On Windows backslashes are used.
     *
     * @param p string path to normalize.
     */
    export function normalize(p: string): string;
    /**
     * Join all arguments together and normalize the resulting path.
     * Arguments must be strings. In v0.8, non-string arguments were silently ignored. In v0.10 and up, an exception is thrown.
     *
     * @param paths string paths to join.
     */
    export function join(...paths: any[]): string;
    /**
     * Join all arguments together and normalize the resulting path.
     * Arguments must be strings. In v0.8, non-string arguments were silently ignored. In v0.10 and up, an exception is thrown.
     *
     * @param paths string paths to join.
     */
    export function join(...paths: string[]): string;
    /**
     * The right-most parameter is considered {to}.  Other parameters are considered an array of {from}.
     *
     * Starting from leftmost {from} paramter, resolves {to} to an absolute path.
     *
     * If {to} isn't already absolute, {from} arguments are prepended in right to left order, until an absolute path is found. If after using all {from} paths still no absolute path is found, the current working directory is used as well. The resulting path is normalized, and trailing slashes are removed unless the path gets resolved to the root directory.
     *
     * @param pathSegments string paths to join.  Non-string arguments are ignored.
     */
    export function resolve(...pathSegments: any[]): string;
    /**
     * Determines whether {path} is an absolute path. An absolute path will always resolve to the same location, regardless of the working directory.
     *
     * @param path path to test.
     */
    export function isAbsolute(path: string): boolean;
    /**
     * Solve the relative path from {from} to {to}.
     * At times we have two absolute paths, and we need to derive the relative path from one to the other. This is actually the reverse transform of path.resolve.
     *
     * @param from
     * @param to
     */
    export function relative(from: string, to: string): string;
    /**
     * Return the directory name of a path. Similar to the Unix dirname command.
     *
     * @param p the path to evaluate.
     */
    export function dirname(p: string): string;
    /**
     * Return the last portion of a path. Similar to the Unix basename command.
     * Often used to extract the file name from a fully qualified path.
     *
     * @param p the path to evaluate.
     * @param ext optionally, an extension to remove from the result.
     */
    export function basename(p: string, ext?: string): string;
    /**
     * Return the extension of the path, from the last '.' to end of string in the last portion of the path.
     * If there is no '.' in the last portion of the path or the first character of it is '.', then it returns an empty string
     *
     * @param p the path to evaluate.
     */
    export function extname(p: string): string;
    /**
     * The platform-specific file separator. '\\' or '/'.
     */
    export var sep: string;
    /**
     * The platform-specific file delimiter. ';' or ':'.
     */
    export var delimiter: string;
    /**
     * Returns an object from a path string - the opposite of format().
     *
     * @param pathString path to evaluate.
     */
    export function parse(pathString: string): ParsedPath;
    /**
     * Returns a path string from an object - the opposite of parse().
     *
     * @param pathString path to evaluate.
     */
    export function format(pathObject: ParsedPath): string;

    export module posix {
      export function normalize(p: string): string;
      export function join(...paths: any[]): string;
      export function resolve(...pathSegments: any[]): string;
      export function isAbsolute(p: string): boolean;
      export function relative(from: string, to: string): string;
      export function dirname(p: string): string;
      export function basename(p: string, ext?: string): string;
      export function extname(p: string): string;
      export var sep: string;
      export var delimiter: string;
      export function parse(p: string): ParsedPath;
      export function format(pP: ParsedPath): string;
    }

    export module win32 {
      export function normalize(p: string): string;
      export function join(...paths: any[]): string;
      export function resolve(...pathSegments: any[]): string;
      export function isAbsolute(p: string): boolean;
      export function relative(from: string, to: string): string;
      export function dirname(p: string): string;
      export function basename(p: string, ext?: string): string;
      export function extname(p: string): string;
      export var sep: string;
      export var delimiter: string;
      export function parse(p: string): ParsedPath;
      export function format(pP: ParsedPath): string;
    }
}

declare module "string_decoder" {
    export interface NodeStringDecoder {
        write(buffer: Buffer): string;
        detectIncompleteChar(buffer: Buffer): number;
    }
    export var StringDecoder: {
        new (encoding: string): NodeStringDecoder;
    };
}

declare module "tls" {
    import * as crypto from "crypto";
    import * as net from "net";
    import * as stream from "stream";

    var CLIENT_RENEG_LIMIT: number;
    var CLIENT_RENEG_WINDOW: number;

    export interface TlsOptions {
        pfx?: any;   //string or buffer
        key?: any;   //string or buffer
        passphrase?: string;
        cert?: any;
        ca?: any;    //string or buffer
        crl?: any;   //string or string array
        ciphers?: string;
        honorCipherOrder?: any;
        requestCert?: boolean;
        rejectUnauthorized?: boolean;
        NPNProtocols?: any;  //array or Buffer;
        SNICallback?: (servername: string) => any;
    }

    export interface ConnectionOptions {
        host?: string;
        port?: number;
        socket?: net.Socket;
        pfx?: any;   //string | Buffer
        key?: any;   //string | Buffer
        passphrase?: string;
        cert?: any;  //string | Buffer
        ca?: any;    //Array of string | Buffer
        rejectUnauthorized?: boolean;
        NPNProtocols?: any;  //Array of string | Buffer
        servername?: string;
    }

    export interface Server extends net.Server {
        // Extended base methods
        listen(port: number, host?: string, backlog?: number, listeningListener?: Function): Server;
        listen(path: string, listeningListener?: Function): Server;
        listen(handle: any, listeningListener?: Function): Server;

        listen(port: number, host?: string, callback?: Function): Server;
        close(): Server;
        address(): { port: number; family: string; address: string; };
        addContext(hostName: string, credentials: {
            key: string;
            cert: string;
            ca: string;
        }): void;
        maxConnections: number;
        connections: number;
    }

    export interface ClearTextStream extends stream.Duplex {
        authorized: boolean;
        authorizationError: Error;
        getPeerCertificate(): any;
        getCipher: {
            name: string;
            version: string;
        };
        address: {
            port: number;
            family: string;
            address: string;
        };
        remoteAddress: string;
        remotePort: number;
    }

    export interface SecurePair {
        encrypted: any;
        cleartext: any;
    }

    export interface SecureContextOptions {
        pfx?: any;   //string | buffer
        key?: any;   //string | buffer
        passphrase?: string;
        cert?: any;  // string | buffer
        ca?: any;    // string | buffer
        crl?: any;   // string | string[]
        ciphers?: string;
        honorCipherOrder?: boolean;
    }

    export interface SecureContext {
        context: any;
    }

    export function createServer(options: TlsOptions, secureConnectionListener?: (cleartextStream: ClearTextStream) =>void ): Server;
    export function connect(options: TlsOptions, secureConnectionListener?: () =>void ): ClearTextStream;
    export function connect(port: number, host?: string, options?: ConnectionOptions, secureConnectListener?: () =>void ): ClearTextStream;
    export function connect(port: number, options?: ConnectionOptions, secureConnectListener?: () =>void ): ClearTextStream;
    export function createSecurePair(credentials?: crypto.Credentials, isServer?: boolean, requestCert?: boolean, rejectUnauthorized?: boolean): SecurePair;
    export function createSecureContext(details: SecureContextOptions): SecureContext;
}

declare module "crypto" {
    export interface CredentialDetails {
        pfx: string;
        key: string;
        passphrase: string;
        cert: string;
        ca: any;    //string | string array
        crl: any;   //string | string array
        ciphers: string;
    }
    export interface Credentials { context?: any; }
    export function createCredentials(details: CredentialDetails): Credentials;
    export function createHash(algorithm: string): Hash;
    export function createHmac(algorithm: string, key: string): Hmac;
    export function createHmac(algorithm: string, key: Buffer): Hmac;
    interface Hash {
        update(data: any, input_encoding?: string): Hash;
        digest(encoding: 'buffer'): Buffer;
        digest(encoding: string): any;
        digest(): Buffer;
    }
    interface Hmac {
        update(data: any, input_encoding?: string): Hmac;
        digest(encoding: 'buffer'): Buffer;
        digest(encoding: string): any;
        digest(): Buffer;
    }
    export function createCipher(algorithm: string, password: any): Cipher;
    export function createCipheriv(algorithm: string, key: any, iv: any): Cipher;
    interface Cipher {
        update(data: Buffer): Buffer;
        update(data: string, input_encoding?: string, output_encoding?: string): string;
        final(): Buffer;
        final(output_encoding: string): string;
        setAutoPadding(auto_padding: boolean): void;
    }
    export function createDecipher(algorithm: string, password: any): Decipher;
    export function createDecipheriv(algorithm: string, key: any, iv: any): Decipher;
    interface Decipher {
        update(data: Buffer): Buffer;
        update(data: string, input_encoding?: string, output_encoding?: string): string;
        final(): Buffer;
        final(output_encoding: string): string;
        setAutoPadding(auto_padding: boolean): void;
    }
    export function createSign(algorithm: string): Signer;
    interface Signer extends NodeJS.WritableStream {
        update(data: any): void;
        sign(private_key: string, output_format: string): string;
    }
    export function createVerify(algorith: string): Verify;
    interface Verify extends NodeJS.WritableStream {
        update(data: any): void;
        verify(object: string, signature: string, signature_format?: string): boolean;
    }
    export function createDiffieHellman(prime_length: number): DiffieHellman;
    export function createDiffieHellman(prime: number, encoding?: string): DiffieHellman;
    interface DiffieHellman {
        generateKeys(encoding?: string): string;
        computeSecret(other_public_key: string, input_encoding?: string, output_encoding?: string): string;
        getPrime(encoding?: string): string;
        getGenerator(encoding: string): string;
        getPublicKey(encoding?: string): string;
        getPrivateKey(encoding?: string): string;
        setPublicKey(public_key: string, encoding?: string): void;
        setPrivateKey(public_key: string, encoding?: string): void;
    }
    export function getDiffieHellman(group_name: string): DiffieHellman;
    export function pbkdf2(password: string, salt: string, iterations: number, keylen: number, callback: (err: Error, derivedKey: Buffer) => any): void;
    export function pbkdf2(password: string, salt: string, iterations: number, keylen: number, digest: string, callback: (err: Error, derivedKey: Buffer) => any): void;
    export function pbkdf2Sync(password: string, salt: string, iterations: number, keylen: number) : Buffer;
    export function pbkdf2Sync(password: string, salt: string, iterations: number, keylen: number, digest: string) : Buffer;
    export function randomBytes(size: number): Buffer;
    export function randomBytes(size: number, callback: (err: Error, buf: Buffer) =>void ): void;
    export function pseudoRandomBytes(size: number): Buffer;
    export function pseudoRandomBytes(size: number, callback: (err: Error, buf: Buffer) =>void ): void;
}

declare module "stream" {
    import * as events from "events";

    export interface Stream extends events.EventEmitter {
        pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
    }

    export interface ReadableOptions {
        highWaterMark?: number;
        encoding?: string;
        objectMode?: boolean;
    }

    export class Readable extends events.EventEmitter implements NodeJS.ReadableStream {
        readable: boolean;
        constructor(opts?: ReadableOptions);
        _read(size: number): void;
        read(size?: number): string|Buffer;
        setEncoding(encoding: string): void;
        pause(): void;
        resume(): void;
        pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
        unpipe<T extends NodeJS.WritableStream>(destination?: T): void;
        unshift(chunk: string): void;
        unshift(chunk: Buffer): void;
        wrap(oldStream: NodeJS.ReadableStream): NodeJS.ReadableStream;
        push(chunk: any, encoding?: string): boolean;
    }

    export interface WritableOptions {
        highWaterMark?: number;
        decodeStrings?: boolean;
    }

    export class Writable extends events.EventEmitter implements NodeJS.WritableStream {
        writable: boolean;
        constructor(opts?: WritableOptions);
        _write(data: Buffer, encoding: string, callback: Function): void;
        _write(data: string, encoding: string, callback: Function): void;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
    }

    export interface DuplexOptions extends ReadableOptions, WritableOptions {
        allowHalfOpen?: boolean;
    }

    // Note: Duplex extends both Readable and Writable.
    export class Duplex extends Readable implements NodeJS.ReadWriteStream {
        writable: boolean;
        constructor(opts?: DuplexOptions);
        _write(data: Buffer, encoding: string, callback: Function): void;
        _write(data: string, encoding: string, callback: Function): void;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
    }

    export interface TransformOptions extends ReadableOptions, WritableOptions {}

    // Note: Transform lacks the _read and _write methods of Readable/Writable.
    export class Transform extends events.EventEmitter implements NodeJS.ReadWriteStream {
        readable: boolean;
        writable: boolean;
        constructor(opts?: TransformOptions);
        _transform(chunk: Buffer, encoding: string, callback: Function): void;
        _transform(chunk: string, encoding: string, callback: Function): void;
        _flush(callback: Function): void;
        read(size?: number): any;
        setEncoding(encoding: string): void;
        pause(): void;
        resume(): void;
        pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T;
        unpipe<T extends NodeJS.WritableStream>(destination?: T): void;
        unshift(chunk: string): void;
        unshift(chunk: Buffer): void;
        wrap(oldStream: NodeJS.ReadableStream): NodeJS.ReadableStream;
        push(chunk: any, encoding?: string): boolean;
        write(buffer: Buffer, cb?: Function): boolean;
        write(str: string, cb?: Function): boolean;
        write(str: string, encoding?: string, cb?: Function): boolean;
        end(): void;
        end(buffer: Buffer, cb?: Function): void;
        end(str: string, cb?: Function): void;
        end(str: string, encoding?: string, cb?: Function): void;
    }

    export class PassThrough extends Transform {}
}

declare module "util" {
    export interface InspectOptions {
        showHidden?: boolean;
        depth?: number;
        colors?: boolean;
        customInspect?: boolean;
    }

    export function format(format: any, ...param: any[]): string;
    export function debug(string: string): void;
    export function error(...param: any[]): void;
    export function puts(...param: any[]): void;
    export function print(...param: any[]): void;
    export function log(string: string): void;
    export function inspect(object: any, showHidden?: boolean, depth?: number, color?: boolean): string;
    export function inspect(object: any, options: InspectOptions): string;
    export function isArray(object: any): boolean;
    export function isRegExp(object: any): boolean;
    export function isDate(object: any): boolean;
    export function isError(object: any): boolean;
    export function inherits(constructor: any, superConstructor: any): void;
}

declare module "assert" {
    function internal (value: any, message?: string): void;
    module internal {
        export class AssertionError implements Error {
            name: string;
            message: string;
            actual: any;
            expected: any;
            operator: string;
            generatedMessage: boolean;

            constructor(options?: {message?: string; actual?: any; expected?: any;
                                  operator?: string; stackStartFunction?: Function});
        }

        export function fail(actual?: any, expected?: any, message?: string, operator?: string): void;
        export function ok(value: any, message?: string): void;
        export function equal(actual: any, expected: any, message?: string): void;
        export function notEqual(actual: any, expected: any, message?: string): void;
        export function deepEqual(actual: any, expected: any, message?: string): void;
        export function notDeepEqual(acutal: any, expected: any, message?: string): void;
        export function strictEqual(actual: any, expected: any, message?: string): void;
        export function notStrictEqual(actual: any, expected: any, message?: string): void;
        export var throws: {
            (block: Function, message?: string): void;
            (block: Function, error: Function, message?: string): void;
            (block: Function, error: RegExp, message?: string): void;
            (block: Function, error: (err: any) => boolean, message?: string): void;
        };

        export var doesNotThrow: {
            (block: Function, message?: string): void;
            (block: Function, error: Function, message?: string): void;
            (block: Function, error: RegExp, message?: string): void;
            (block: Function, error: (err: any) => boolean, message?: string): void;
        };

        export function ifError(value: any): void;
    }

    export = internal;
}

declare module "tty" {
    import * as net from "net";

    export function isatty(fd: number): boolean;
    export interface ReadStream extends net.Socket {
        isRaw: boolean;
        setRawMode(mode: boolean): void;
    }
    export interface WriteStream extends net.Socket {
        columns: number;
        rows: number;
    }
}

declare module "domain" {
    import * as events from "events";

    export class Domain extends events.EventEmitter {
        run(fn: Function): void;
        add(emitter: events.EventEmitter): void;
        remove(emitter: events.EventEmitter): void;
        bind(cb: (err: Error, data: any) => any): any;
        intercept(cb: (data: any) => any): any;
        dispose(): void;

        addListener(event: string, listener: Function): Domain;
        on(event: string, listener: Function): Domain;
        once(event: string, listener: Function): Domain;
        removeListener(event: string, listener: Function): Domain;
        removeAllListeners(event?: string): Domain;
    }

    export function create(): Domain;
}

declare module "constants" {
    export var E2BIG: number;
    export var EACCES: number;
    export var EADDRINUSE: number;
    export var EADDRNOTAVAIL: number;
    export var EAFNOSUPPORT: number;
    export var EAGAIN: number;
    export var EALREADY: number;
    export var EBADF: number;
    export var EBADMSG: number;
    export var EBUSY: number;
    export var ECANCELED: number;
    export var ECHILD: number;
    export var ECONNABORTED: number;
    export var ECONNREFUSED: number;
    export var ECONNRESET: number;
    export var EDEADLK: number;
    export var EDESTADDRREQ: number;
    export var EDOM: number;
    export var EEXIST: number;
    export var EFAULT: number;
    export var EFBIG: number;
    export var EHOSTUNREACH: number;
    export var EIDRM: number;
    export var EILSEQ: number;
    export var EINPROGRESS: number;
    export var EINTR: number;
    export var EINVAL: number;
    export var EIO: number;
    export var EISCONN: number;
    export var EISDIR: number;
    export var ELOOP: number;
    export var EMFILE: number;
    export var EMLINK: number;
    export var EMSGSIZE: number;
    export var ENAMETOOLONG: number;
    export var ENETDOWN: number;
    export var ENETRESET: number;
    export var ENETUNREACH: number;
    export var ENFILE: number;
    export var ENOBUFS: number;
    export var ENODATA: number;
    export var ENODEV: number;
    export var ENOENT: number;
    export var ENOEXEC: number;
    export var ENOLCK: number;
    export var ENOLINK: number;
    export var ENOMEM: number;
    export var ENOMSG: number;
    export var ENOPROTOOPT: number;
    export var ENOSPC: number;
    export var ENOSR: number;
    export var ENOSTR: number;
    export var ENOSYS: number;
    export var ENOTCONN: number;
    export var ENOTDIR: number;
    export var ENOTEMPTY: number;
    export var ENOTSOCK: number;
    export var ENOTSUP: number;
    export var ENOTTY: number;
    export var ENXIO: number;
    export var EOPNOTSUPP: number;
    export var EOVERFLOW: number;
    export var EPERM: number;
    export var EPIPE: number;
    export var EPROTO: number;
    export var EPROTONOSUPPORT: number;
    export var EPROTOTYPE: number;
    export var ERANGE: number;
    export var EROFS: number;
    export var ESPIPE: number;
    export var ESRCH: number;
    export var ETIME: number;
    export var ETIMEDOUT: number;
    export var ETXTBSY: number;
    export var EWOULDBLOCK: number;
    export var EXDEV: number;
    export var WSAEINTR: number;
    export var WSAEBADF: number;
    export var WSAEACCES: number;
    export var WSAEFAULT: number;
    export var WSAEINVAL: number;
    export var WSAEMFILE: number;
    export var WSAEWOULDBLOCK: number;
    export var WSAEINPROGRESS: number;
    export var WSAEALREADY: number;
    export var WSAENOTSOCK: number;
    export var WSAEDESTADDRREQ: number;
    export var WSAEMSGSIZE: number;
    export var WSAEPROTOTYPE: number;
    export var WSAENOPROTOOPT: number;
    export var WSAEPROTONOSUPPORT: number;
    export var WSAESOCKTNOSUPPORT: number;
    export var WSAEOPNOTSUPP: number;
    export var WSAEPFNOSUPPORT: number;
    export var WSAEAFNOSUPPORT: number;
    export var WSAEADDRINUSE: number;
    export var WSAEADDRNOTAVAIL: number;
    export var WSAENETDOWN: number;
    export var WSAENETUNREACH: number;
    export var WSAENETRESET: number;
    export var WSAECONNABORTED: number;
    export var WSAECONNRESET: number;
    export var WSAENOBUFS: number;
    export var WSAEISCONN: number;
    export var WSAENOTCONN: number;
    export var WSAESHUTDOWN: number;
    export var WSAETOOMANYREFS: number;
    export var WSAETIMEDOUT: number;
    export var WSAECONNREFUSED: number;
    export var WSAELOOP: number;
    export var WSAENAMETOOLONG: number;
    export var WSAEHOSTDOWN: number;
    export var WSAEHOSTUNREACH: number;
    export var WSAENOTEMPTY: number;
    export var WSAEPROCLIM: number;
    export var WSAEUSERS: number;
    export var WSAEDQUOT: number;
    export var WSAESTALE: number;
    export var WSAEREMOTE: number;
    export var WSASYSNOTREADY: number;
    export var WSAVERNOTSUPPORTED: number;
    export var WSANOTINITIALISED: number;
    export var WSAEDISCON: number;
    export var WSAENOMORE: number;
    export var WSAECANCELLED: number;
    export var WSAEINVALIDPROCTABLE: number;
    export var WSAEINVALIDPROVIDER: number;
    export var WSAEPROVIDERFAILEDINIT: number;
    export var WSASYSCALLFAILURE: number;
    export var WSASERVICE_NOT_FOUND: number;
    export var WSATYPE_NOT_FOUND: number;
    export var WSA_E_NO_MORE: number;
    export var WSA_E_CANCELLED: number;
    export var WSAEREFUSED: number;
    export var SIGHUP: number;
    export var SIGINT: number;
    export var SIGILL: number;
    export var SIGABRT: number;
    export var SIGFPE: number;
    export var SIGKILL: number;
    export var SIGSEGV: number;
    export var SIGTERM: number;
    export var SIGBREAK: number;
    export var SIGWINCH: number;
    export var SSL_OP_ALL: number;
    export var SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION: number;
    export var SSL_OP_CIPHER_SERVER_PREFERENCE: number;
    export var SSL_OP_CISCO_ANYCONNECT: number;
    export var SSL_OP_COOKIE_EXCHANGE: number;
    export var SSL_OP_CRYPTOPRO_TLSEXT_BUG: number;
    export var SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS: number;
    export var SSL_OP_EPHEMERAL_RSA: number;
    export var SSL_OP_LEGACY_SERVER_CONNECT: number;
    export var SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER: number;
    export var SSL_OP_MICROSOFT_SESS_ID_BUG: number;
    export var SSL_OP_MSIE_SSLV2_RSA_PADDING: number;
    export var SSL_OP_NETSCAPE_CA_DN_BUG: number;
    export var SSL_OP_NETSCAPE_CHALLENGE_BUG: number;
    export var SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG: number;
    export var SSL_OP_NETSCAPE_REUSE_CIPHER_CHANGE_BUG: number;
    export var SSL_OP_NO_COMPRESSION: number;
    export var SSL_OP_NO_QUERY_MTU: number;
    export var SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION: number;
    export var SSL_OP_NO_SSLv2: number;
    export var SSL_OP_NO_SSLv3: number;
    export var SSL_OP_NO_TICKET: number;
    export var SSL_OP_NO_TLSv1: number;
    export var SSL_OP_NO_TLSv1_1: number;
    export var SSL_OP_NO_TLSv1_2: number;
    export var SSL_OP_PKCS1_CHECK_1: number;
    export var SSL_OP_PKCS1_CHECK_2: number;
    export var SSL_OP_SINGLE_DH_USE: number;
    export var SSL_OP_SINGLE_ECDH_USE: number;
    export var SSL_OP_SSLEAY_080_CLIENT_DH_BUG: number;
    export var SSL_OP_SSLREF2_REUSE_CERT_TYPE_BUG: number;
    export var SSL_OP_TLS_BLOCK_PADDING_BUG: number;
    export var SSL_OP_TLS_D5_BUG: number;
    export var SSL_OP_TLS_ROLLBACK_BUG: number;
    export var ENGINE_METHOD_DSA: number;
    export var ENGINE_METHOD_DH: number;
    export var ENGINE_METHOD_RAND: number;
    export var ENGINE_METHOD_ECDH: number;
    export var ENGINE_METHOD_ECDSA: number;
    export var ENGINE_METHOD_CIPHERS: number;
    export var ENGINE_METHOD_DIGESTS: number;
    export var ENGINE_METHOD_STORE: number;
    export var ENGINE_METHOD_PKEY_METHS: number;
    export var ENGINE_METHOD_PKEY_ASN1_METHS: number;
    export var ENGINE_METHOD_ALL: number;
    export var ENGINE_METHOD_NONE: number;
    export var DH_CHECK_P_NOT_SAFE_PRIME: number;
    export var DH_CHECK_P_NOT_PRIME: number;
    export var DH_UNABLE_TO_CHECK_GENERATOR: number;
    export var DH_NOT_SUITABLE_GENERATOR: number;
    export var NPN_ENABLED: number;
    export var RSA_PKCS1_PADDING: number;
    export var RSA_SSLV23_PADDING: number;
    export var RSA_NO_PADDING: number;
    export var RSA_PKCS1_OAEP_PADDING: number;
    export var RSA_X931_PADDING: number;
    export var RSA_PKCS1_PSS_PADDING: number;
    export var POINT_CONVERSION_COMPRESSED: number;
    export var POINT_CONVERSION_UNCOMPRESSED: number;
    export var POINT_CONVERSION_HYBRID: number;
    export var O_RDONLY: number;
    export var O_WRONLY: number;
    export var O_RDWR: number;
    export var S_IFMT: number;
    export var S_IFREG: number;
    export var S_IFDIR: number;
    export var S_IFCHR: number;
    export var S_IFLNK: number;
    export var O_CREAT: number;
    export var O_EXCL: number;
    export var O_TRUNC: number;
    export var O_APPEND: number;
    export var F_OK: number;
    export var R_OK: number;
    export var W_OK: number;
    export var X_OK: number;
    export var UV_UDP_REUSEADDR: number;
}

// Generated by typings
// Source: https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/7de6c3dd94feaeb21f20054b9f30d5dabc5efabd/socket.io/socket.io.d.ts
declare module 'socket.io' {
	var server: SocketIOStatic;

	export = server;
}

interface SocketIOStatic {
	/**
	 * Default Server constructor
	 */
	(): SocketIO.Server;

	/**
	 * Creates a new Server
	 * @param srv The HTTP server that we're going to bind to
	 * @param opts An optional parameters object
	 */
	(srv: any, opts?: SocketIO.ServerOptions): SocketIO.Server;

	/**
	 * Creates a new Server
	 * @param port A port to bind to, as a number, or a string
	 * @param An optional parameters object
	 */
	(port: string|number, opts?: SocketIO.ServerOptions): SocketIO.Server;

	/**
	 * Creates a new Server
	 * @param A parameters object
	 */
	(opts: SocketIO.ServerOptions): SocketIO.Server;

	/**
	 * Backwards compatibility
	 * @see io().listen()
	 */
    listen: SocketIOStatic;
}

declare namespace SocketIO {

	interface Server {

		/**
		 * A dictionary of all the namespaces currently on this Server
		 */
		nsps: {[namespace: string]: Namespace};

		/**
		 * The default '/' Namespace
		 */
		sockets: Namespace;

		/**
		 * Sets the 'json' flag when emitting an event
		 */
		json: Server;

		/**
		 * Server request verification function, that checks for allowed origins
		 * @param req The http.IncomingMessage request
		 * @param fn The callback to be called. It should take one parameter, err,
		 * which will be null if there was no problem, and one parameter, success,
		 * of type boolean
		 */
		checkRequest( req:any, fn:( err: any, success: boolean ) => void ):void;

		/**
		 * Gets whether we're serving the client.js file or not
		 * @default true
		 */
		serveClient(): boolean;

		/**
		 * Sets whether we're serving the client.js file or not
		 * @param v True if we want to serve the file, false otherwise
		 * @default true
		 * @return This Server
		 */
		serveClient( v: boolean ): Server;

		/**
		 * Gets the client serving path
		 * @default '/socket.io'
		 */
		path(): string;

		/**
		 * Sets the client serving path
		 * @param v The path to serve the client file on
		 * @default '/socket.io'
		 * @return This Server
		 */
		path( v: string ): Server;

		/**
		 * Gets the adapter that we're going to use for handling rooms
		 * @default typeof Adapter
		 */
		adapter(): any;

		/**
		 * Sets the adapter (class) that we're going to use for handling rooms
		 * @param v The class for the adapter to create
		 * @default typeof Adapter
		 * @return This Server
		 */
		adapter( v: any ): Server;

		/**
		 * Gets the allowed origins for requests
		 * @default "*:*"
		 */
		origins(): string;

		/**
		 * Sets the allowed origins for requests
		 * @param v The allowed origins, in host:port form
		 * @default "*:*"
		 * return This Server
		 */
		origins( v: string ): Server;

		/**
		 * Attaches socket.io to a server
		 * @param srv The http.Server that we want to attach to
		 * @param opts An optional parameters object
		 * @return This Server
		 */
		attach( srv: any, opts?: ServerOptions ): Server;

		/**
		 * Attaches socket.io to a port
		 * @param port The port that we want to attach to
		 * @param opts An optional parameters object
		 * @return This Server
		 */
		attach( port: number, opts?: ServerOptions ): Server;

		/**
		 * @see attach( srv, opts )
		 */
		listen( srv: any, opts?: ServerOptions ): Server;

		/**
		 * @see attach( port, opts )
		 */
		listen( port: number, opts?: ServerOptions ): Server;

		/**
		 * Binds socket.io to an engine.io intsance
		 * @param src The Engine.io (or compatible) server to bind to
		 * @return This Server
		 */
		bind( srv: any ): Server;

		/**
		 * Called with each incoming connection
		 * @param socket The Engine.io Socket
		 * @return This Server
		 */
		onconnection( socket: any ): Server;

		/**
		 * Looks up/creates a Namespace
		 * @param nsp The name of the NameSpace to look up/create. Should start
		 * with a '/'
		 * @return The Namespace
		 */
		of( nsp: string ): Namespace;

		/**
		 * Closes the server connection
		 */
		close():void;

		/**
		 * The event fired when we get a new connection
		 * @param event The event being fired: 'connection'
		 * @param listener A listener that should take one parameter of type Socket
		 * @return The default '/' Namespace
		 */
		on( event: 'connection', listener: ( socket: Socket ) => void ): Namespace;

		/**
		 * @see on( 'connection', listener )
		 */
		on( event: 'connect', listener: ( socket: Socket ) => void ): Namespace;

		/**
		 * Base 'on' method to add a listener for an event
		 * @param event The event that we want to add a listener for
		 * @param listener The callback to call when we get the event. The parameters
		 * for the callback depend on the event
		 * @return The default '/' Namespace
		 */
		on( event: string, listener: Function ): Namespace;

		/**
		 * Targets a room when emitting to the default '/' Namespace
		 * @param room The name of the room that we're targeting
		 * @return The default '/' Namespace
		 */
		to( room: string ): Namespace;

		/**
		 * @see to( room )
		 */
		in( room: string ): Namespace;

		/**
		 * Registers a middleware function, which is a function that gets executed
		 * for every incoming Socket, on the default '/' Namespace
		 * @param fn The function to call when we get a new incoming socket. It should
		 * take one parameter of type Socket, and one callback function to call to
		 * execute the next middleware function. The callback can take one optional
		 * parameter, err, if there was an error. Errors passed to middleware callbacks
		 * are sent as special 'error' packets to clients
		 * @return The default '/' Namespace
		 */
		use( fn: ( socket:Socket, fn: ( err?: any ) => void ) =>void ): Namespace;

		/**
		 * Emits an event to the default Namespace
		 * @param event The event that we want to emit
		 * @param args Any number of optional arguments to pass with the event. If the
		 * last argument is a function, it will be called as an ack. The ack should
		 * take whatever data was sent with the packet
		 * @return The default '/' Namespace
		 */
		emit( event: string, ...args: any[]): Namespace;

		/**
		 * Sends a 'message' event
		 * @see emit( event, ...args )
		 * @return The default '/' Namespace
		 */
		send( ...args: any[] ): Namespace;

		/**
		 * @see send( ...args )
		 */
		write( ...args: any[] ): Namespace;

		/**
		 * Gets a list of clients
		 * @return The default '/' Namespace
		 */
		clients( ...args: any[] ): Namespace;

		/**
		 * Sets the compress flag
		 * @return The default '/' Namespace
		 */
		compress( ...args: any[] ): Namespace;
	}

	/**
	 * Options to pass to our server when creating it
	 */
	interface ServerOptions {

		/**
		 * The path to server the client file to
		 * @default '/socket.io'
		 */
		path?: string;

		/**
		 * Should we serve the client file?
		 * @default true
		 */
		serveClient?: boolean;

		/**
		 * The adapter to use for handling rooms. NOTE: this should be a class,
		 * not an object
		 * @default typeof Adapter
		 */
		adapter?: Adapter;

		/**
		 * Accepted origins
		 * @default '*:*'
		 */
		origins?: string;

		/**
		 * How many milliseconds without a pong packed to consider the connection closed (engine.io)
		 * @default 60000
		 */
		pingTimeout?: number;

		/**
		 * How many milliseconds before sending a new ping packet (keep-alive) (engine.io)
		 * @default 25000
		 */
		pingInterval?: number;

		/**
		 * How many bytes or characters a message can be when polling, before closing the session
		 * (to avoid Dos) (engine.io)
		 * @default 10E7
		 */
		maxHttpBufferSize?: number;

		/**
		 * A function that receives a given handshake or upgrade request as its first parameter,
		 * and can decide whether to continue or not. The second argument is a function that needs
		 * to be called with the decided information: fn( err, success ), where success is a boolean
		 * value where false means that the request is rejected, and err is an error code (engine.io)
		 * @default null
		 */
		allowRequest?: (request:any, callback: (err: number, success: boolean) => void) => void;

		/**
		 * Transports to allow connections to (engine.io)
		 * @default ['polling','websocket']
		 */
		transports?: string[];

		/**
		 * Whether to allow transport upgrades (engine.io)
		 * @default true
		 */
		allowUpgrades?: boolean;

		/**
		 * parameters of the WebSocket permessage-deflate extension (see ws module).
		 * Set to false to disable (engine.io)
		 * @default true
		 */
		perMessageDeflate?: Object|boolean;

		/**
		 * Parameters of the http compression for the polling transports (see zlib).
		 * Set to false to disable, or set an object with parameter "threshold:number"
		 * to only compress data if the byte size is above this value (1024) (engine.io)
		 * @default true|1024
		 */
		httpCompression?: Object|boolean;

		/**
		 * Name of the HTTP cookie that contains the client sid to send as part of
		 * handshake response headers. Set to false to not send one (engine.io)
		 * @default "io"
		 */
		cookie?: string|boolean;
	}

	/**
	 * The Namespace, sandboxed environments for sockets, each connection
	 * to a Namespace requires a new Socket
	 */
	interface Namespace extends NodeJS.EventEmitter {

		/**
		 * The name of the NameSpace
		 */
		name: string;

		/**
		 * The controller Server for this Namespace
		 */
		server: Server;

		/**
		 * A dictionary of all the Sockets connected to this Namespace, where
		 * the Socket ID is the key
		 */
		sockets: { [id: string]: Socket };

		/**
		 * A dictionary of all the Sockets connected to this Namespace, where
		 * the Socket ID is the key
		 */
		connected: { [id: string]: Socket };

		/**
		 * The Adapter that we're using to handle dealing with rooms etc
		 */
		adapter: Adapter;

		/**
		 * Sets the 'json' flag when emitting an event
		 */
		json: Namespace;

		/**
		 * Registers a middleware function, which is a function that gets executed
		 * for every incoming Socket
		 * @param fn The function to call when we get a new incoming socket. It should
		 * take one parameter of type Socket, and one callback function to call to
		 * execute the next middleware function. The callback can take one optional
		 * parameter, err, if there was an error. Errors passed to middleware callbacks
		 * are sent as special 'error' packets to clients
		 * @return This Namespace
		 */
		use( fn: ( socket:Socket, fn: ( err?: any ) => void ) =>void ): Namespace;

		/**
		 * Targets a room when emitting
		 * @param room The name of the room that we're targeting
		 * @return This Namespace
		 */
		to( room: string ): Namespace;

		/**
		 * @see to( room )
		 */
		in( room: string ): Namespace;

		/**
		 * Sends a 'message' event
		 * @see emit( event, ...args )
		 * @return This Namespace
		 */
		send( ...args: any[] ): Namespace;

		/**
		 * @see send( ...args )
		 */
		write( ...args: any[] ): Namespace;

		/**
		 * The event fired when we get a new connection
		 * @param event The event being fired: 'connection'
		 * @param listener A listener that should take one parameter of type Socket
		 * @return This Namespace
		 */
		on( event: 'connection', listener: ( socket: Socket ) => void ): this;

		/**
		 * @see on( 'connection', listener )
		 */
		on( event: 'connect', listener: ( socket: Socket ) => void ): this;

		/**
		 * Base 'on' method to add a listener for an event
		 * @param event The event that we want to add a listener for
		 * @param listener The callback to call when we get the event. The parameters
		 * for the callback depend on the event
		 * @ This Namespace
		 */
		on( event: string, listener: Function ): this;

		/**
		 * Gets a list of clients.
		 * @return This Namespace
		 */
		clients( fn: Function ): Namespace;

		/**
		 * Sets the compress flag.
		 * @param compress If `true`, compresses the sending data
		 * @return This Namespace
		 */
		compress( compress: boolean ): Namespace;
	}

	/**
	 * The socket, which handles our connection for a namespace. NOTE: while
	 * we technically extend NodeJS.EventEmitter, we're not putting it here
	 * as we have a problem with the emit() event (as it's overridden with a
	 * different return)
	 */
	interface Socket {

		/**
		 * The namespace that this socket is for
		 */
		nsp: Namespace;

		/**
		 * The Server that our namespace is in
		 */
		server: Server;

		/**
		 * The Adapter that we use to handle our rooms
		 */
		adapter: Adapter;

		/**
		 * The unique ID for this Socket. Regenerated at every connection. This is
		 * also the name of the room that the Socket automatically joins on connection
		 */
		id: string;

		/**
		 * The http.IncomingMessage request sent with the connection. Useful
		 * for recovering headers etc
		 */
		request: any;

		/**
		 * The Client associated with this Socket
		 */
		client: Client;

		/**
		 * The underlying Engine.io Socket instance
		 */
		conn: {

			/**
			 * The ID for this socket - matches Client.id
			 */
			id: string;

			/**
			 * The Engine.io Server for this socket
			 */
			server: any;

			/**
			 * The ready state for the client. Either 'opening', 'open', 'closing', or 'closed'
			 */
			readyState: string;

			/**
			 * The remote IP for this connection
			 */
			remoteAddress: string;
		};

		/**
		 * The list of rooms that this Socket is currently in, where
		 * the ID the the room ID
		 */
		rooms: { [id: string]: string };

		/**
		 * Is the Socket currently connected?
		 */
		connected: boolean;

		/**
		 * Is the Socket currently disconnected?
		 */
		disconnected: boolean;

		/**
		 * The object used when negociating the handshake
		 */
		handshake: {
			/**
			 * The headers passed along with the request. e.g. 'host',
			 * 'connection', 'accept', 'referer', 'cookie'
			 */
			headers: any;

			/**
			 * The current time, as a string
			 */
			time: string;

			/**
			 * The remote address of the connection request
			 */
			address: string;

			/**
			 * Is this a cross-domain request?
			 */
			xdomain: boolean;

			/**
			 * Is this a secure request?
			 */
			secure: boolean;

			/**
			 * The timestamp for when this was issued
			 */
			issued: number;

			/**
			 * The request url
			 */
			url: string;

			/**
			 * Any query string parameters in the request url
			 */
			query: any;
		};

		/**
		 * Sets the 'json' flag when emitting an event
		 */
		json: Socket;

		/**
		 * Sets the 'volatile' flag when emitting an event. Volatile messages are
		 * messages that can be dropped because of network issues and the like. Use
		 * for high-volume/real-time messages where you don't need to receive *all*
		 * of them
		 */
		volatile: Socket;

		/**
		 * Sets the 'broadcast' flag when emitting an event. Broadcasting an event
		 * will send it to all the other sockets in the namespace except for yourself
		 */
		broadcast: Socket;

		/**
		 * Emits an event to this client. If the 'broadcast' flag was set, this will
		 * emit to all other clients, except for this one
		 * @param event The event that we want to emit
		 * @param args Any number of optional arguments to pass with the event. If the
		 * last argument is a function, it will be called as an ack. The ack should
		 * take whatever data was sent with the packet
		 * @return This Socket
		 */
		emit( event: string, ...args: any[]): Socket;

		/**
		 * Targets a room when broadcasting
		 * @param room The name of the room that we're targeting
		 * @return This Socket
		 */
		to( room: string ): Socket;

		/**
		 * @see to( room )
		 */
		in( room: string ): Socket;

		/**
		 * Sends a 'message' event
		 * @see emit( event, ...args )
		 */
		send( ...args: any[] ): Socket;

		/**
		 * @see send( ...args )
		 */
		write( ...args: any[] ): Socket;

		/**
		 * Joins a room. You can join multiple rooms, and by default, on connection,
		 * you join a room with the same name as your ID
		 * @param name The name of the room that we want to join
		 * @param fn An optional callback to call when we've joined the room. It should
		 * take an optional parameter, err, of a possible error
		 * @return This Socket
		 */
		join( name: string, fn?: ( err?: any ) => void ): Socket;

		/**
		 * Leaves a room
		 * @param name The name of the room to leave
		 * @param fn An optional callback to call when we've left the room. It should
		 * take on optional parameter, err, of a possible error
		 */
		leave( name: string, fn?: Function ): Socket;

		/**
		 * Leaves all the rooms that we've joined
		 */
		leaveAll(): void;

		/**
		 * Disconnects this Socket
		 * @param close If true, also closes the underlying connection
		 * @return This Socket
		 */
		disconnect( close?: boolean ): Socket;

		/**
		 * Adds a listener for a particular event. Calling multiple times will add
		 * multiple listeners
		 * @param event The event that we're listening for
		 * @param fn The function to call when we get the event. Parameters depend on the
		 * event in question
		 * @return This Socket
		 */
		on( event: string, fn: Function ): Socket;

		/**
		 * @see on( event, fn )
		 */
		addListener( event: string, fn: Function ): Socket;

		/**
		 * Adds a listener for a particular event that will be invoked
		 * a single time before being automatically removed
		 * @param event The event that we're listening for
		 * @param fn The function to call when we get the event. Parameters depend on
		 * the event in question
		 * @return This Socket
		 */
		once( event: string, fn: Function ): Socket;

		/**
		 * Removes a listener for a particular type of event. This will either
		 * remove a specific listener, or all listeners for this type of event
		 * @param event The event that we want to remove the listener of
		 * @param fn The function to remove, or null if we want to remove all functions
		 * @return This Socket
		 */
		removeListener( event: string, fn?: Function ): Socket;

		/**
		 * Removes all event listeners on this object
		 * @return This Socket
		 */
		removeAllListeners( event?: string ): Socket;

		/**
		 * Sets the maximum number of listeners this instance can have
		 * @param n The max number of listeners we can add to this emitter
		 * @return This Socket
		 */
		setMaxListeners( n: number ): Socket;

		/**
		 * Returns all the callbacks for a particular event
		 * @param event The event that we're looking for the callbacks of
		 * @return An array of callback Functions, or an empty array if we don't have any
		 */
		listeners( event: string ):Function[];

		/**
		 * Sets the compress flag
		 * @param compress If `true`, compresses the sending data
		 * @return This Socket
		 */
		compress( compress: boolean ): Socket;
	}

	/**
	 * The interface used when dealing with rooms etc
	 */
	interface Adapter extends NodeJS.EventEmitter {

		/**
		 * The namespace that this adapter is for
		 */
		nsp: Namespace;

		/**
		 * A dictionary of all the rooms that we have in this namespace
		 * The rooms are made of a `sockets` key which is the dictionary of sockets per ID
		 */
		rooms: {[room: string]: {sockets: {[id: string]: boolean }}};

		/**
		 * A dictionary of all the socket ids that we're dealing with, and all
		 * the rooms that the socket is currently in
		 */
		sids: {[id: string]: {[room: string]: boolean}};

		/**
		 * Adds a socket to a room. If the room doesn't exist, it's created
		 * @param id The ID of the socket to add
		 * @param room The name of the room to add the socket to
		 * @param callback An optional callback to call when the socket has been
		 * added. It should take an optional parameter, error, if there was a problem
		 */
		add( id: string, room: string, callback?: ( err?: any ) => void ): void;

		/**
		 * Removes a socket from a room. If there are no more sockets in the room,
		 * the room is deleted
		 * @param id The ID of the socket that we're removing
		 * @param room The name of the room to remove the socket from
		 * @param callback An optional callback to call when the socket has been
		 * removed. It should take on optional parameter, error, if there was a problem
		 */
		del( id: string, room: string, callback?: ( err?: any ) => void ): void;

		/**
		 * Removes a socket from all the rooms that it's joined
		 * @param id The ID of the socket that we're removing
		 */
		delAll( id: string ):void;

		/**
		 * Broadcasts a packet
		 * @param packet The packet to broadcast
		 * @param opts Any options to send along:
		 * 	- rooms: An optional list of rooms to broadcast to. If empty, the packet is broadcast to all sockets
		 * 	- except: A list of Socket IDs to exclude
		 * 	- flags: Any flags that we want to send along ('json', 'volatile', 'broadcast')
		 */
		broadcast( packet: any, opts: { rooms?: string[]; except?: string[]; flags?: {[flag: string]: boolean} } ):void;
	}

	/**
	 * The client behind each socket (can have multiple sockets)
	 */
	interface Client {
		/**
		 * The Server that this client belongs to
		 */
		server: Server;

		/**
		 * The underlying Engine.io Socket instance
		 */
		conn: {

			/**
			 * The ID for this socket - matches Client.id
			 */
			id: string;

			/**
			 * The Engine.io Server for this socket
			 */
			server: any;

			/**
			 * The ready state for the client. Either 'opening', 'open', 'closing', or 'closed'
			 */
			readyState: string;

			/**
			 * The remote IP for this connection
			 */
			remoteAddress: string;
		};

		/**
		 * The ID for this client. Regenerated at every connection
		 */
		id: string;

		/**
		 * The http.IncomingMessage request sent with the connection. Useful
		 * for recovering headers etc
		 */
		request: any;

		/**
		 * The dictionary of sockets currently connect via this client (i.e. to different
		 * namespaces) where the Socket ID is the key
		 */
		sockets: {[id: string]: Socket};

		/**
		 * A dictionary of all the namespaces for this client, with the Socket that
		 * deals with that namespace
		 */
		nsps: {[nsp: string]: Socket};
	}
}


// Type definitions for socket.io-client 1.4.4
// Project: http://socket.io/
// Definitions by: PROGRE <https://github.com/progre/>, Damian Connolly <https://github.com/divillysausages/>, Florent Poujol <https://github.com/florentpoujol/>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare var io: SocketIOClientStatic;

declare module 'socket.io-client' {
	export = io;
}

interface SocketIOClientStatic {

	/**
	 * Looks up an existing 'Manager' for multiplexing. If the user summons:
	 * 	'io( 'http://localhost/a' );'
	 * 	'io( 'http://localhost/b' );'
	 *
	 * We reuse the existing instance based on the same scheme/port/host, and
	 * we initialize sockets for each namespace. If autoConnect isn't set to
	 * false in the options, then we'll automatically connect
	 * @param uri The uri that we'll connect to, including the namespace, where '/' is the default one (e.g. http://localhost:4000/somenamespace)
	 * @opts Any connect options that we want to pass along
	 * @return A Socket object
	 */
	( uri: string, opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Socket;

	/**
	 * Auto-connects to the window location and defalt namespace.
	 * E.g. window.protocol + '//' + window.host + ':80/'
	 * @opts Any connect options that we want to pass along
	 * @return A Socket object
	 */
	( opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Socket;

	/**
	 * @see the default constructor (io(uri, opts))
	 */
	connect( uri: string, opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Socket;

	/**
	 * @see the default constructor (io(opts))
	 */
	connect( opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Socket;

	/**
	 * The socket.io protocol revision number this client works with
	 * @default 4
	 */
	protocol: number;

	/**
	 * Socket constructor - exposed for the standalone build
	 */
	Socket: SocketIOClient.Socket;

	/**
	 * Manager constructor - exposed for the standalone build
	 */
	Manager: SocketIOClient.ManagerStatic;
}

declare namespace SocketIOClient {

	/**
	 * The base emiter class, used by Socket and Manager
	 */
	interface Emitter {
		/**
		 * Adds a listener for a particular event. Calling multiple times will add
		 * multiple listeners
		 * @param event The event that we're listening for
		 * @param fn The function to call when we get the event. Parameters depend on the
		 * event in question
		 * @return This Emitter
		 */
		on( event: string, fn: Function ):Emitter;

		/**
		 * @see on( event, fn )
		 */
		addEventListener( event: string, fn: Function ):Emitter;

		/**
		 * Adds a listener for a particular event that will be invoked
		 * a single time before being automatically removed
		 * @param event The event that we're listening for
		 * @param fn The function to call when we get the event. Parameters depend on
		 * the event in question
		 * @return This Emitter
		 */
		once( event: string, fn: Function ):Emitter;

		/**
		 * Removes a listener for a particular type of event. This will either
		 * remove a specific listener, or all listeners for this type of event
		 * @param event The event that we want to remove the listener of
		 * @param fn The function to remove, or null if we want to remove all functions
		 * @return This Emitter
		 */
		off( event: string, fn?: Function ):Emitter;

		/**
		 * @see off( event, fn )
		 */
		removeListener( event: string, fn?: Function ):Emitter;

		/**
		 * @see off( event, fn )
		 */
		removeEventListener( event: string, fn?: Function ):Emitter;

		/**
		 * Removes all event listeners on this object
		 * @return This Emitter
		 */
		removeAllListeners():Emitter;

		/**
		 * Emits 'event' with the given args
		 * @param event The event that we want to emit
		 * @param args Optional arguments to emit with the event
		 * @return Emitter
		 */
		emit( event: string, ...args: any[] ):Emitter;

		/**
		 * Returns all the callbacks for a particular event
		 * @param event The event that we're looking for the callbacks of
		 * @return An array of callback Functions, or an empty array if we don't have any
		 */
		listeners( event: string ):Function[];

		/**
		 * Returns if we have listeners for a particular event
		 * @param event The event that we want to check if we've listeners for
		 * @return True if we have listeners for this event, false otherwise
		 */
		hasListeners( event: string ):boolean;
	}

	/**
	 * The Socket static interface
	 */
	interface SocketStatic {

		/**
		 * Creates a new Socket, used for communicating with a specific namespace
		 * @param io The Manager that's controlling this socket
		 * @param nsp The namespace that this socket is for (@default '/')
		 * @return A new Socket
		 */
		( io: SocketIOClient.Manager, nsp: string ): Socket;

		/**
		 * Creates a new Socket, used for communicating with a specific namespace
		 * @param io The Manager that's controlling this socket
		 * @param nsp The namespace that this socket is for (@default '/')
		 * @return A new Socket
		 */
		new ( url: string, opts: any ): SocketIOClient.Manager;
	}

	/**
	 * The Socket that we use to connect to a Namespace on the server
	 */
	interface Socket extends Emitter {

		/**
		 * The Manager that's controller this socket
		 */
		io: SocketIOClient.Manager;

		/**
		 * The namespace that this socket is for
		 * @default '/'
		 */
		nsp: string;

		/**
		 * The ID of the socket; matches the server ID and is set when we're connected, and cleared
		 * when we're disconnected
		 */
		id: string;

		/**
		 * Are we currently connected?
		 * @default false
		 */
		connected: boolean;

		/**
		 * Are we currently disconnected?
		 * @default true
		 */
		disconnected: boolean;

		/**
		 * Opens our socket so that it connects. If the 'autoConnect' option for io is
		 * true (default), then this is called automatically when the Socket is created
		 */
		open(): Socket;

		/**
		 * @see open();
		 */
		connect(): Socket;

		/**
		 * Sends a 'message' event
		 * @param args Any optional arguments that we want to send
		 * @see emit
		 * @return This Socket
		 */
		send( ...args: any[] ):Socket;

		/**
		 * An override of the base emit. If the event is one of:
		 * 	connect
		 * 	connect_error
		 * 	connect_timeout
		 * 	connecting
		 * 	disconnect
		 * 	error
		 * 	reconnect
		 * 	reconnect_attempt
		 * 	reconnect_failed
		 * 	reconnect_error
		 * 	reconnecting
		 * 	ping
		 * 	pong
		 * then the event is emitted normally. Otherwise, if we're connected, the
		 * event is sent. Otherwise, it's buffered.
		 *
		 * If the last argument is a function, then it will be called
		 * as an 'ack' when the response is received. The parameter(s) of the
		 * ack will be whatever data is returned from the event
		 * @param event The event that we're emitting
		 * @param args Optional arguments to send with the event
		 * @return This Socket
		 */
		emit( event: string, ...args: any[] ):Socket;

		/**
		 * Disconnects the socket manually
		 * @return This Socket
		 */
		close():Socket;

		/**
		 * @see close()
		 */
		disconnect():Socket;

		/**
		* Sets the compress flag.
		* @param compress If `true`, compresses the sending data
		* @return this Socket
		*/
		compress(compress: boolean):Socket;
	}

	/**
	 * The Manager static interface
	 */
	interface ManagerStatic {
		/**
		 * Creates a new Manager
		 * @param uri The URI that we're connecting to (e.g. http://localhost:4000)
		 * @param opts Any connection options that we want to use (and pass to engine.io)
		 * @return A Manager
		 */
		( uri: string, opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Manager;

		/**
		 * Creates a new Manager with the default URI (window host)
		 * @param opts Any connection options that we want to use (and pass to engine.io)
		 */
		( opts: SocketIOClient.ConnectOpts ):SocketIOClient.Manager;

		/**
		 * @see default constructor
		 */
		new ( uri: string, opts?: SocketIOClient.ConnectOpts ): SocketIOClient.Manager;

		/**
		 * @see default constructor
		 */
		new ( opts: SocketIOClient.ConnectOpts ):SocketIOClient.Manager;
	}

	/**
	 * The Manager class handles all the Namespaces and Sockets that we're using
	 */
	interface Manager extends Emitter {

		/**
		 * All the namespaces currently controlled by this Manager, and the Sockets
		 * that we're using to communicate with them
		 */
		nsps: { [namespace:string]: Socket };

		/**
		 * The connect options that we used when creating this Manager
		 */
		opts: SocketIOClient.ConnectOpts;

		/**
		 * The state of the Manager. Either 'closed', 'opening', or 'open'
		 */
		readyState: string;

		/**
		 * The URI that this manager is for (host + port), e.g. 'http://localhost:4000'
		 */
		uri: string;

		/**
		 * The currently connected sockets
		 */
		connecting: Socket[];

		/**
		 * If we should auto connect (also used when creating Sockets). Set via the
		 * opts object
		 */
		autoConnect: boolean;

		/**
		 * Gets if we should reconnect automatically
		 * @default true
		 */
		reconnection(): boolean;

		/**
		 * Sets if we should reconnect automatically
		 * @param v True if we should reconnect automatically, false otherwise
		 * @default true
		 * @return This Manager
		 */
		reconnection( v: boolean ): Manager;

		/**
		 * Gets the number of reconnection attempts we should try before giving up
		 * @default Infinity
		 */
		reconnectionAttempts(): number;

		/**
		 * Sets the number of reconnection attempts we should try before giving up
		 * @param v The number of attempts we should do before giving up
		 * @default Infinity
		 * @return This Manager
		 */
		reconnectionAttempts( v: number ): Manager;

		/**
		 * Gets the delay in milliseconds between each reconnection attempt
		 * @default 1000
		 */
		reconnectionDelay(): number;

		/**
		 * Sets the delay in milliseconds between each reconnection attempt
		 * @param v The delay in milliseconds
		 * @default 1000
		 * @return This Manager
		 */
		reconnectionDelay( v: number ): Manager;

		/**
		 * Gets the max reconnection delay in milliseconds between each reconnection
		 * attempt
		 * @default 5000
		 */
		reconnectionDelayMax(): number;

		/**
		 * Sets the max reconnection delay in milliseconds between each reconnection
		 * attempt
		 * @param v The max reconnection dleay in milliseconds
		 * @return This Manager
		 */
		reconnectionDelayMax( v: number ): Manager;

		/**
		 * Gets the randomisation factor used in the exponential backoff jitter
		 * when reconnecting
		 * @default 0.5
		 */
		randomizationFactor(): number;

		/**
		 * Sets the randomisation factor used in the exponential backoff jitter
		 * when reconnecting
		 * @param The reconnection randomisation factor
		 * @default 0.5
		 * @return This Manager
		 */
		randomizationFactor( v: number ): Manager;

		/**
		 * Gets the timeout in milliseconds for our connection attempts
		 * @default 20000
		 */
		timeout(): number;

		/**
		 * Sets the timeout in milliseconds for our connection attempts
		 * @param The connection timeout milliseconds
		 * @return This Manager
		 */
		timeout(v: boolean): Manager;

		/**
		 * Sets the current transport socket and opens our connection
		 * @param fn An optional callback to call when our socket has either opened, or
		 * failed. It can take one optional parameter of type Error
		 * @return This Manager
		 */
		open( fn?: (err?: any) => void ): Manager;

		/**
		 * @see open( fn );
		 */
		connect( fn?: (err?: any) => void ): Manager;

		/**
		 * Creates a new Socket for the given namespace
		 * @param nsp The namespace that this Socket is for
		 * @return A new Socket, or if one has already been created for this namespace,
		 * an existing one
		 */
		socket( nsp: string ): Socket;
	}

	/**
	 * Options we can pass to the socket when connecting
	 */
	interface ConnectOpts {

		/**
		 * Should we force a new Manager for this connection?
		 * @default false
		 */
		forceNew?: boolean;

		/**
		 * Should we multiplex our connection (reuse existing Manager) ?
		 * @default true
		 */
		multiplex?: boolean;

		/**
		 * The path to get our client file from, in the case of the server
		 * serving it
		 * @default '/socket.io'
		 */
		path?: string;

		/**
		 * Should we allow reconnections?
		 * @default true
		 */
		reconnection?: boolean;

		/**
		 * How many reconnection attempts should we try?
		 * @default Infinity
		 */
		reconnectionAttempts?: number;

		/**
		 * The time delay in milliseconds between reconnection attempts
		 * @default 1000
		 */
		reconnectionDelay?: number;

		/**
		 * The max time delay in milliseconds between reconnection attempts
		 * @default 5000
		 */
		reconnectionDelayMax?: number;

		/**
		 * Used in the exponential backoff jitter when reconnecting
		 * @default 0.5
		 */
		randomizationFactor?: number;

		/**
		 * The timeout in milliseconds for our connection attempt
		 * @default 20000
		 */
		timeout?: number;

		/**
		 * Should we automically connect?
		 * @default true
		 */
		autoConnect?: boolean;

		/**
		 * The host that we're connecting to. Set from the URI passed when connecting
		 */
		host?: string;

		/**
		 * The hostname for our connection. Set from the URI passed when connecting
		 */
		hostname?: string;

		/**
		 * If this is a secure connection. Set from the URI passed when connecting
		 */
		secure?: boolean;

		/**
		 * The port for our connection. Set from the URI passed when connecting
		 */
		port?: string;

		/**
		 * Any query parameters in our uri. Set from the URI passed when connecting
		 */
		query?: Object;

		/**
		 * `http.Agent` to use, defaults to `false` (NodeJS only)
		 */
		agent?: string|boolean;

		/**
		 * Whether the client should try to upgrade the transport from
		 * long-polling to something better.
		 * @default true
		 */
		upgrade?: boolean;

		/**
		 * Forces JSONP for polling transport.
		 */
		forceJSONP?: boolean;

		/**
		 * Determines whether to use JSONP when necessary for polling. If
		 * disabled (by settings to false) an error will be emitted (saying
		 * "No transports available") if no other transports are available.
		 * If another transport is available for opening a connection (e.g.
		 * WebSocket) that transport will be used instead.
		 * @default true
		 */
		jsonp?: boolean;

		/**
		 * Forces base 64 encoding for polling transport even when XHR2
		 * responseType is available and WebSocket even if the used standard
		 * supports binary.
		 */
		forceBase64?: boolean;

		/**
		 * Enables XDomainRequest for IE8 to avoid loading bar flashing with
		 * click sound. default to `false` because XDomainRequest has a flaw
		 * of not sending cookie.
		 * @default false
		 */
		enablesXDR?: boolean;

		/**
		 * The param name to use as our timestamp key
		 * @default 't'
		 */
		timestampParam?: string;

		/**
		 * Whether to add the timestamp with each transport request. Note: this
		 * is ignored if the browser is IE or Android, in which case requests
		 * are always stamped
		 * @default false
		 */
		timestampRequests?: boolean;

		/**
		 * A list of transports to try (in order). Engine.io always attempts to
		 * connect directly with the first one, provided the feature detection test
		 * for it passes.
		 * @default ['polling','websocket']
		 */
		transports?: string[];

		/**
		 * The port the policy server listens on
		 * @default 843
		 */
		policyPost?: number;

		/**
		 * If true and if the previous websocket connection to the server succeeded,
		 * the connection attempt will bypass the normal upgrade process and will
		 * initially try websocket. A connection attempt following a transport error
		 * will use the normal upgrade process. It is recommended you turn this on
		 * only when using SSL/TLS connections, or if you know that your network does
		 * not block websockets.
		 * @default false
		 */
		rememberUpgrade?: boolean;

		/**
		 * Are we only interested in transports that support binary?
		 */
		onlyBinaryUpgrades?: boolean;

		/**
		 * (SSL) Certificate, Private key and CA certificates to use for SSL.
		 * Can be used in Node.js client environment to manually specify
		 * certificate information.
		 */
		pfx?: string;

		/**
		 * (SSL) Private key to use for SSL. Can be used in Node.js client
		 * environment to manually specify certificate information.
		 */
		key?: string;

		/**
		 * (SSL) A string or passphrase for the private key or pfx. Can be
		 * used in Node.js client environment to manually specify certificate
		 * information.
		 */
		passphrase?: string

		/**
		 * (SSL) Public x509 certificate to use. Can be used in Node.js client
		 * environment to manually specify certificate information.
		 */
		cert?: string;

		/**
		 * (SSL) An authority certificate or array of authority certificates to
		 * check the remote host against.. Can be used in Node.js client
		 * environment to manually specify certificate information.
		 */
		ca?: string|string[];

		/**
		 * (SSL) A string describing the ciphers to use or exclude. Consult the
		 * [cipher format list]
		 * (http://www.openssl.org/docs/apps/ciphers.html#CIPHER_LIST_FORMAT) for
		 * details on the format.. Can be used in Node.js client environment to
		 * manually specify certificate information.
		 */
		ciphers?: string;

		/**
		 * (SSL) If true, the server certificate is verified against the list of
		 * supplied CAs. An 'error' event is emitted if verification fails.
		 * Verification happens at the connection level, before the HTTP request
		 * is sent. Can be used in Node.js client environment to manually specify
		 * certificate information.
		 */
		rejectUnauthorized?: boolean;

	}
}