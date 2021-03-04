// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import svg2img from 'svg2img';   // svg files to image buffer
import { PNG } from 'pngjs';     // png image file reader
import jsQR from 'jsqr';         // qr image decoder
import core from 'file-type/core';
import {OutputTree, ResultWithErrors, ErrorCode, LogItem} from './error';
import * as jws from './jws-compact';


interface FileInfo {
    name: string,
    path: string,
    ext: string,
    encoding: string | null,
    type: "text" | "binary",
    buffer: Buffer,
    fileType: core.FileTypeResult | string | undefined
}


export async function validate(qr: FileInfo[]): Promise<OutputTree> {

    const output = new OutputTree('QR code (' + (qr[0].fileType as string) + ')');

    const results = await decode(qr);

    output.add(results.errors);

    if (results.result != null) {
        output.child = await jws.validate(results.result);
    } 

    return output;
}



// Converts a SVG file into a QR image buffer (as if read from a image file)
async function svgToImageBuffer(svgPath: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        svg2img(svgPath, { width: 600, height: 600, quality: 100 }, function (error: unknown, buffer: Buffer) {
            if (error) reject(error);
            resolve(buffer);
        });
    });
}


// Decode QR image buffer to base64 string
function decodeQrBuffer(image: Buffer): ResultWithErrors {

    const result = new ResultWithErrors();

    const png = PNG.sync.read(image);

    const code = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height);

    if (code == null) {
        result.errors.push(new LogItem("Could not decode QR image.", ErrorCode.QR_DECODE_ERROR));
        return result;
    }

    return shcToJws(code.data);
}


function shcChunksToJws(shc: string[]): ResultWithErrors {
    let result = new ResultWithErrors();
    const chunkCount = shc.length;
    const jwsChunks = new Array(chunkCount);
    for (let shcChunk of shc) {
        const chunkResult = shcToJws(shcChunk, chunkCount);
        if (chunkResult.errors.length > 0) {
            // propagate errors, if any
            for (let err of chunkResult.errors) {
                result.error(err.message, err.code, err.logLevel); // TODO: overload this method to take a LogInfo
            }
            continue; // move on to next chunk
        }
        const chunkIndex = chunkResult.chunkIndex;
        if (jwsChunks[chunkIndex-1]) {
            // we have a chunk index collision
            result.error('we have two chunks with index ' + chunkIndex, ErrorCode.INVALID_QR_CHUNK_INDEX);
        } else {
            jwsChunks[chunkIndex-1] =  chunkResult.result;
        }
    }
    // make sure we have all chunks we expect
    for (let i = 0; i < chunkCount; i++) {
        if (!jwsChunks[i]) {
            result.error('missing QR chunk ' + i, ErrorCode.INVALID_QR_CHUNK_INDEX);
        }
    }

    result.result = jwsChunks.join('');
    return result;
}

function shcToJws(shc: string, chunkCount = 1): ResultWithErrors {

    const result = new ResultWithErrors();
    const chunked = chunkCount > 1; // TODO: what about chunk 1 of 1 ('shc:/1/1/...' it's legal but shouldn't happen)
    const qrHeader = 'shc:/';
    let chunkIndex = 1;
    let bodyIndex = chunked ? qrHeader.length + 4 :  qrHeader.length;

    // check numeric QR header
    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/.+$` : `^${qrHeader}.+$`, 'g').test(shc)) {
        return result.error("Invalid numeric QR header: expected" + chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`, ErrorCode.INVALID_NUMERIC_QR_HEADER);
    }
    // check numeric QR encoding
    if (!new RegExp(chunked ? `^${qrHeader}[0-9]/${chunkCount}/[0-9]+$` : `^${qrHeader}[0-9]+$`, 'g').test(shc)) {
        return result.error("Invalid numeric QR: expected" + chunked ? `${qrHeader}[0-9]+` : `${qrHeader}[0-9]/[0-9]/[0-9]+`, ErrorCode.INVALID_NUMERIC_QR);
    }

    // get the chunk index
    if (chunked) {
        chunkIndex = parseInt((shc.match(new RegExp('^shc:/[0-9]')) as RegExpMatchArray)[0].substring(5,6));
        if (chunkIndex < 1 || chunkIndex > chunkCount) {
            return result.error("Invalid QR chunk index: " + chunkIndex, ErrorCode.INVALID_QR_CHUNK_INDEX);
        }
    }

    const b64Offset = '-'.charCodeAt(0);
    const digitPairs = shc.substring(bodyIndex).match(/(\d\d?)/g);

    if (digitPairs == null) {
        return result.error("Invalid numeric QR code", ErrorCode.INVALID_NUMERIC_QR);
    }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    result.result = jws;
    result.chunkIndex = chunkIndex;

    return result;
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo[]): Promise<ResultWithErrors> {

    let svgBuffer;
    const result = new ResultWithErrors();

    switch (fileInfo[0].fileType) { // TODO: how to deal with different inconsistent files

    case 'svg':
        svgBuffer = await svgToImageBuffer(fileInfo[0].buffer.toString()); // TODO: handle multiple files
        return decodeQrBuffer(svgBuffer);

    case 'shc':
        return Promise.resolve(shcChunksToJws(fileInfo.map(fi => fi.buffer.toString())));

    case 'png':
        return decodeQrBuffer(fileInfo[0].buffer); // TODO: handle multiple files

    case 'jpg':
        return result.error("jpg : Not implemented", ErrorCode.NOT_IMPLEMENTED);

    case 'bmp':
        return result.error("bmp : Not implemented", ErrorCode.NOT_IMPLEMENTED);

    default:
        return result.error("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
    }

}
