// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';


export async function validate(qr: string[]): Promise<{ result: JWS | undefined, log: Log }> {

    const log = new Log(
        qr.length > 1 ?
            'QR numeric (' + qr.length.toString() + ')' :
            'QR numeric');

    const jwsString: JWS | undefined = shcChunksToJws(qr, log); //await decode(qr, log);

    jwsString && (log.child = (await jws.validate(jwsString)).log);

    return { result: jwsString, log: log };
}


function shcChunksToJws(shc: string[], log : Log): JWS | undefined {

    const chunkCount = shc.length;
    const jwsChunks = new Array(chunkCount);

    for (const shcChunk of shc) {

        const chunkResult = shcToJws(shcChunk, log, chunkCount);

        // bad header is fatal (according to tests)
        if(!chunkResult) return undefined; // move on to next chunk

        const chunkIndex = chunkResult.chunkIndex;
        
        if (jwsChunks[chunkIndex - 1]) {
            // we have a chunk index collision
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.error('we have two chunks with index ' + chunkIndex, ErrorCode.INVALID_QR_CHUNK_INDEX);
        } else {
            jwsChunks[chunkIndex - 1] = chunkResult.result;
        }
    }
    // make sure we have all chunks we expect
    for (let i = 0; i < chunkCount; i++) {
        if (!jwsChunks[i]) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.error('missing QR chunk ' + i, ErrorCode.INVALID_QR_CHUNK_INDEX);
        }
    }

    if(shc.length > 1) log.info('All shc parts decoded');

    log.debug('JWS = ' + jwsChunks.join(''));

    return jwsChunks.join('');
}


function shcToJws(shc: string, log: Log, chunkCount = 1): {result: JWS, chunkIndex: number} | undefined {

    const chunked = chunkCount > 1; // TODO: what about chunk 1 of 1 ('shc:/1/1/...' it's legal but shouldn't happen)
    const qrHeader = 'shc:/';
    let chunkIndex = 1;
    const bodyIndex = chunked ? qrHeader.length + 4 : qrHeader.length;

    // check numeric QR header
    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/.+$` : `^${qrHeader}.+$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        log.fatal("Invalid numeric QR header: expected" + chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`, ErrorCode.INVALID_NUMERIC_QR_HEADER);
        return undefined;
    }
    // check numeric QR encoding
    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/[0-9]+$` : `^${qrHeader}[0-9]+$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        log.fatal("Invalid numeric QR: expected" + chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`, ErrorCode.INVALID_NUMERIC_QR);
        return undefined;
    }

    // get the chunk index
    if (chunked) {
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        chunkIndex = parseInt((shc.match(new RegExp('^shc:/[0-9]')) as RegExpMatchArray)[0].substring(5, 6));
        if (chunkIndex < 1 || chunkIndex > chunkCount) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.fatal("Invalid QR chunk index: " + chunkIndex, ErrorCode.INVALID_QR_CHUNK_INDEX);
            return undefined;
        }
    }

    const b64Offset = '-'.charCodeAt(0);
    const digitPairs = shc.substring(bodyIndex).match(/(\d\d?)/g);

    if (digitPairs == null) {
        log.fatal("Invalid numeric QR code", ErrorCode.INVALID_NUMERIC_QR);
        return undefined;
    }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    log.info( shc.slice(0, shc.lastIndexOf('/')) + '/... decoded');
    log.debug( shc.slice(0, shc.lastIndexOf('/')) + '/... = ' + jws);

    return  { result: jws, chunkIndex : chunkIndex};
}
