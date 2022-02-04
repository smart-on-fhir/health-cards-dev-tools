// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';
import { IOptions } from './options';

const MAX_SINGLE_QR_LENGTH = 1195;
const MAX_QR_CHUNK_LENGTH = 1191;

export async function validate(qr: string[], options: IOptions): Promise<Log> {

    const log = new Log(
        qr.length > 1 ?
            'QR numeric (' + qr.length.toString() + ')' :
            'QR numeric');

    const jwsString: JWS | undefined = shcChunksToJws(qr, log);

    jwsString && options.cascade && (log.child.push((await jws.validate(jwsString, options))));

    return log;
}


function shcChunksToJws(shc: string[], log: Log): JWS | undefined {

    const chunkCount = shc.length;
    const jwsChunks = new Array<string>(chunkCount);

    for (let shcChunk of shc) {

        if (shcChunk.trim() !== shcChunk) {
            log.error(`Numeric QR has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
            shcChunk = shcChunk.trim();
        }

        const chunkResult = shcToJws(shcChunk, log, chunkCount);

        if (!chunkResult) return undefined; // move on to next chunk

        const chunkIndex = chunkResult.chunkIndex;
        const maxQRLength = chunkCount > 1 ? MAX_QR_CHUNK_LENGTH : MAX_SINGLE_QR_LENGTH;
        if (chunkResult.result.length > maxQRLength) {
            log.error(`QR chunk ${chunkIndex} is larger than ${maxQRLength} bytes`, ErrorCode.INVALID_NUMERIC_QR);
        }

        if (jwsChunks[chunkIndex - 1]) {
            // we have a chunk index collision
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.fatal(`we have two chunks with index ${chunkIndex}`, ErrorCode.INVALID_NUMERIC_QR_HEADER);
            return undefined;
        } else {
            jwsChunks[chunkIndex - 1] = chunkResult.result;
        }
    }
    // make sure we have all chunks we expect
    for (let i = 0; i < chunkCount; i++) {
        if (!jwsChunks[i]) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.fatal('missing QR chunk ' + i, ErrorCode.MISSING_QR_CHUNK);
            return undefined;
        }
    }

    if (shc.length > 1) log.info('All shc parts decoded');

    const jws = jwsChunks.join('');

    if (chunkCount > 1 && jws.length <= MAX_SINGLE_QR_LENGTH) {
        log.warn(`JWS of size ${jws.length} (<= ${MAX_SINGLE_QR_LENGTH}) didn't need to be split in ${chunkCount} chunks`, ErrorCode.INVALID_QR);
    }

    // check if chunk sizes are balanced
    const expectedChunkSize = Math.floor(jws.length / chunkCount);
    const balancedSizeBuffer = Math.ceil(expectedChunkSize * (0.5 / 100)); // give some leeway to what we call "balanced", 0.5% away from expected size
    if (jwsChunks.map(jwsChunk => jwsChunk.length)
        .reduce((unbalanced, length) => unbalanced || length < expectedChunkSize - balancedSizeBuffer || length > expectedChunkSize + balancedSizeBuffer, false)) {
        log.warn("QR chunk sizes are unbalanced: " + jwsChunks.map(jwsChunk => jwsChunk.length.toString()).join(), ErrorCode.UNBALANCED_QR_CHUNKS);
    }

    log.debug('JWS = ' + jws);
    return jws;
}


function shcToJws(shc: string, log: Log, chunkCount = 1): { result: JWS, chunkIndex: number } | undefined {

    let chunked = chunkCount > 1;
    const qrHeader = 'shc:/';
    const positiveIntRegExp = '[1-9][0-9]*';
    let chunkIndex = 1;

    // check numeric QR header
    const isChunkedHeader = new RegExp(`^${qrHeader}${positiveIntRegExp}/${chunkCount}/.*$`).test(shc);
    if (chunked) {
        if (!isChunkedHeader) {
            // should have been a valid chunked header, check if we are missing one
            const hasBadChunkCount = new RegExp(`^${qrHeader}${positiveIntRegExp}/[1-9][0-9]*/.*$`).test(shc);
            const found = shc.match(new RegExp(`^${qrHeader}${positiveIntRegExp}/(?<expectedChunkCount2>[1-9][0-9]*)/.*$`)); // FIXME!!!!!
            //if (found) console.log(found);
            if (hasBadChunkCount) {
                const expectedChunkCount = parseInt(shc.substring(7, 8));
                log.fatal(`Missing QR code chunk: received ${chunkCount}, expected ${expectedChunkCount}`, ErrorCode.MISSING_QR_CHUNK);
                return undefined;
            }
        }
    } else {
        if (isChunkedHeader) {
            log.warn(`Single-chunk numeric QR code should have a header ${qrHeader}, not ${qrHeader}1/1/`, ErrorCode.INVALID_NUMERIC_QR_HEADER);
            chunked = true; // interpret the code as chunked even though it shouldn't
        }
    }

    if (!new RegExp(chunked ? `^${qrHeader}${positiveIntRegExp}/${chunkCount}/.*$` : `^${qrHeader}.*$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const expectedHeader = chunked ? `${qrHeader}${positiveIntRegExp}/${positiveIntRegExp}/` : `${qrHeader}`;
        log.error(`Invalid numeric QR header: expected ${expectedHeader}`, ErrorCode.INVALID_NUMERIC_QR_HEADER);
        return undefined;
    }

    // check numeric QR encoding
    if (!new RegExp(chunked ? `^${qrHeader}${positiveIntRegExp}/${chunkCount}/[0-9]+$` : `^${qrHeader}[0-9]+$`, 'g').test(shc)) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const expectedBody = chunked ? `${qrHeader}${positiveIntRegExp}/${positiveIntRegExp}/[0-9]+` : `${qrHeader}[0-9]+`;
        log.fatal(`Invalid numeric QR: expected ${expectedBody}`, ErrorCode.INVALID_NUMERIC_QR);
        return undefined;
    }

    // get the chunk index
    if (chunked) {
        // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
        const found = shc.match(new RegExp(`^shc:/(?<chunkIndex>${positiveIntRegExp})`));
        chunkIndex = (found && found.groups && found.groups['chunkIndex']) ? parseInt(found.groups['chunkIndex']) : -1;
        if (chunkIndex < 1 || chunkIndex > chunkCount) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.fatal("Invalid QR chunk index: " + chunkIndex, ErrorCode.INVALID_NUMERIC_QR_HEADER);
            return undefined;
        }
    }

    const bodyIndex = shc.lastIndexOf('/') + 1;
    const b64Offset = '-'.charCodeAt(0);
    const digitPairs = shc.substring(bodyIndex).match(/(\d\d?)/g);

    if (digitPairs == null || digitPairs[digitPairs.length - 1].length == 1) {
        log.fatal("Invalid numeric QR code, can't parse digit pairs. Numeric values should have even length.\n" +
            "Make sure no leading 0 are deleted from the encoding.", ErrorCode.INVALID_NUMERIC_QR);
        return undefined;
    }

    // since source of numeric encoding is base64url-encoded data (A-Z, a-z, 0-9, -, _, =), the lowest
    // expected value is 0 (ascii(-) - 45) and the biggest one is 77 (ascii(z) - 45), check that each pair
    // is no larger than 77
    if (Math.max(...digitPairs.map(d => Number.parseInt(d))) > 77) {
        log.fatal("Invalid numeric QR code, one digit pair is bigger than the max value 77 (encoding of 'z')." +
            "Make sure you followed the encoding rules.", ErrorCode.INVALID_NUMERIC_QR);
        return undefined;
    }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56,...]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    log.info(shc.slice(0, shc.lastIndexOf('/')) + '/... decoded');
    log.debug(shc.slice(0, shc.lastIndexOf('/')) + '/... = ' + jws);

    return { result: jws, chunkIndex: chunkIndex };
}
