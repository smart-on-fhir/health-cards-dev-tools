// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import svg2img from 'svg2img';   // svg files to image buffer
import { PNG } from 'pngjs';     // png image file reader
import jsQR from 'jsqr';         // qr image decoder
import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';
import { FileInfo } from './file';


export async function validate(qr: FileInfo[]): Promise<{ result: JWS | undefined, log: Log }> {

    const log = new Log('QR code (' + (qr[0].fileType as string) + ')');

    const results: JWS | undefined = await decode(qr, log);

    results && await jws.validate(results);

    return { result: results, log: log };
}


// the svg data is turned into an image buffer. these values ensure that the resulting image is readable
// by the QR image decoder. 
const svgImageWidth = 600;
const svgImageHeight = 600;
const svgImageQuality = 100;


// TODO: find minimal values that cause the resulting image to fail decoding.

// Converts a SVG file into a QR image buffer (as if read from a image file)
async function svgToImageBuffer(svgPath: string, log: Log): Promise<Buffer> {

    // TODO: create a test that causes failure here
    return new Promise<Buffer>((resolve, reject) => {
        svg2img(svgPath, { width: svgImageWidth, height: svgImageHeight, quality: svgImageQuality },
            (error: unknown, buffer: Buffer) => {
                if (error) {
                    log.fatal("Could not convert SVG to image. Error: " + (error as Error).message);
                    reject(undefined);
                }
                resolve(buffer);
            });
    });
}


// Decode QR image buffer to base64 string
function decodeQrBuffer(image: Buffer, log: Log): string | undefined {

    const result: JWS | undefined = undefined;

    const png = PNG.sync.read(image);

    // TODO : create a test that causes failure here
    const code = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height);

    if (code == null) {
        log.fatal("Could not decode QR image.", ErrorCode.QR_DECODE_ERROR);
        return result;
    }

    return code.data;
}


function shcChunksToJws(shc: string[], log : Log): JWS | undefined {

    const chunkCount = shc.length;
    const jwsChunks = new Array(chunkCount);

    for (const shcChunk of shc) {

        const chunkResult = shcToJws(shcChunk, log, chunkCount);


        if(!chunkResult) continue; // move on to next chunk

        // if (chunkResult.errors.length > 0) {
        //     // propagate errors, if any
        //     for (let err of chunkResult.errors) {
        //         result.error(err.message, err.code, err.logLevel); // TODO: overload this method to take a LogInfo
        //     }
        //     continue; // move on to next chunk
        // }

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

    return  { result: jws, chunkIndex : chunkIndex};
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo[], log: Log): Promise<string | undefined> {

    let svgBuffer;
    //const result = new ResultWithErrors();

    switch (fileInfo[0].fileType) { // TODO: how to deal with different inconsistent files

        case 'svg':
            svgBuffer = await svgToImageBuffer(fileInfo[0].buffer.toString(), log); // TODO: handle multiple files
            return decodeQrBuffer(svgBuffer, log);

        case 'shc':
            return Promise.resolve(shcChunksToJws(fileInfo.map(fi => fi.buffer.toString()), log));

        case 'png':
            return decodeQrBuffer(fileInfo[0].buffer, log); // TODO: handle multiple files

        case 'jpg':
            log.fatal("jpg : Not implemented", ErrorCode.NOT_IMPLEMENTED);
            return undefined;

        case 'bmp':
            log.fatal("bmp : Not implemented", ErrorCode.NOT_IMPLEMENTED);
            return undefined;

        default:
            log.fatal("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
            return undefined;
    }

}
