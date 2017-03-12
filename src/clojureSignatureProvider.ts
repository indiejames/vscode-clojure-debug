import {ParameterInformation, SignatureHelp, SignatureInformation, SignatureHelpProvider, TextDocument, Position, CancellationToken, Hover} from 'vscode';
import {EditorUtils} from './editorUtils';
import {ReplConnection} from './replConnection';

function isVariadic(sig: Array<string>): boolean {
	let rval = false;
	if (sig) {
		for (let param of sig) {
			if (param == "&") {
				rval = true;
				break;
			}
		}
	}
	return rval;
}

// handles variadic signature
function sigLength(sig: Array<string>) {
	let nonVariadicSig = sig.filter((val) => {
		return val != "&"
	});

	return nonVariadicSig.length;
}

export class ClojureSignatureProvider implements SignatureHelpProvider {
	private connection: ReplConnection;

  constructor(conn: ReplConnection) {
    this.connection = conn;
  }

	provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Thenable<SignatureHelp> {
		let self = this;
    let ns = EditorUtils.findNSDeclaration(document.getText());
    let pSig = EditorUtils.getArgumentSignature(document,position);
		// ignore things outside of a namespace
		if (ns == null || pSig == null || pSig[0] == null || pSig[0] == "") {
			return Promise.reject("");
		}

		try {
			return new Promise<SignatureHelp>((resolve, reject) => {
				if (this.connection.isConnected()) {
					this.connection.sigs(ns, pSig[0], (err: any, msg: any) => {
						if(!token.isCancellationRequested) {
							if (err) {
								reject(err);
							} else {
								var sigs = msg[0]["sigs"];
								if (!sigs) {
									resolve(undefined);
								} else {
 									let sigInfos = sigs.map((sig: Array<string>): SignatureInformation => {
										const sigLabel = "(" + pSig[0] + " " + sig.join(" ") + ")";
										let sigInfo = new SignatureInformation(sigLabel);

										let nonVariadicSig = sig.filter((val) => {
											return val != "&";
										});

										sigInfo.parameters = nonVariadicSig.map((arg) => {
											return new ParameterInformation(arg);
										});

										return sigInfo;
									});


									let sigHelp = new SignatureHelp();
									sigHelp.signatures = sigInfos;
									sigHelp.activeParameter = pSig[1];
									sigHelp.activeSignature = -1;

									let index = 0;
									for (let sig of sigs) {
										const sigLen = sigLength(sig);
										if (sigLen > 0 && sigLen > sigHelp.activeParameter) {
											sigHelp.activeSignature = index;
											break;
										}

										index += 1;
									}

									// handle variadic signatures
									if (sigHelp.activeSignature == -1 && isVariadic(sigs[sigs.length - 1])) {
										sigHelp.activeSignature = sigs.length - 1;
										sigHelp.activeParameter = sigLength(sigs[sigs.length - 1]) - 1;
									}

									resolve(sigHelp);
								}
							}
						}
					});
				} else {
					reject();
				}
			});
		} catch (Error){
			return Promise.reject([]);
		}
	}
}