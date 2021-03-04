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


export async function validate(qrSvg: FileInfo): Promise<OutputTree> {

    const output = new OutputTree('QR code (' + (qrSvg.fileType as string) + ')');

    const results = await decode(qrSvg);

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


function shcToJws(shc: string): ResultWithErrors {

    const result = new ResultWithErrors();

    if (!/^shc:\/\d+$/g.test(shc)) {
        return result.error("Invalid 'shc:/' header string", ErrorCode.INVALID_SHC_STRING);
    }

    const b64Offset = '-'.charCodeAt(0);
    const digitPairs = shc.match(/(\d\d?)/g);

    if (digitPairs == null) {
        return result.error("Invalid 'shc:/' header string", ErrorCode.INVALID_SHC_STRING);
    }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    result.result = jws;

    return result;
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo): Promise<ResultWithErrors> {

    let svgBuffer;
    const result = new ResultWithErrors();

    switch (fileInfo.fileType) {

    case 'svg':
        svgBuffer = await svgToImageBuffer(fileInfo.buffer.toString());
        return decodeQrBuffer(svgBuffer);

    case 'shc':
        return Promise.resolve(shcToJws(fileInfo.buffer.toString()));

    case 'png':
        return decodeQrBuffer(fileInfo.buffer);

    case 'jpg':
        return result.error("jpg : Not implemented", ErrorCode.NOT_IMPLEMENTED);

    case 'bmp':
        return result.error("bmp : Not implemented", ErrorCode.NOT_IMPLEMENTED);

    default:
        return result.error("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
    }

}
