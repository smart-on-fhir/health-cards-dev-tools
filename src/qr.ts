// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import svg2img from 'svg2img';   // svg files to image buffer
import { PNG } from 'pngjs';     // png image file reader
import jsQR from 'jsqr';         // qr image decoder
import core from 'file-type/core';
import { ErrorCode } from './error';
import * as jws from './jws-compact';
import { Log } from './logger';


interface FileInfo {
    name: string,
    path: string,
    ext: string,
    encoding: string | null,
    type: "text" | "binary",
    buffer: Buffer,
    fileType: core.FileTypeResult | string | undefined
}


export async function validate(qrSvg: FileInfo): Promise<{result: JWS | undefined, log :Log}> {

    const log = new Log('QR code (' + (qrSvg.fileType as string) + ')');

    const results : JWS | undefined = await decode(qrSvg, log);

    results && await jws.validate(results);

    return { result: results, log : log };
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
function decodeQrBuffer(image: Buffer, log: Log): JWS | undefined {

    const result: JWS | undefined = undefined;

    const png = PNG.sync.read(image);

    // TODO : create a test that causes failure here
    const code = jsQR(new Uint8ClampedArray(png.data.buffer), png.width, png.height);

    if (code == null) {
        log.fatal("Could not decode QR image.", ErrorCode.QR_DECODE_ERROR);
        return result;
    }

    return shcToJws(code.data, log);
}


function shcToJws(shc: string, log: Log): JWS | undefined {

    const b64Offset = '-'.charCodeAt(0);

    // check the header, we can still process if the header is wrong.
    if (!/^shc:\//.test(shc)) {
        log.error("Invalid 'shc:/' header string", ErrorCode.INVALID_SHC_STRING);
    }

    // check
    const digitPairs = shc.match(/(\d\d)+$/g);

    if (digitPairs == null) {
        // we cannot continue without any data
        log.fatal("Invalid shc data. Data should be an even numbered string of digits ([0-9][0-9])+", ErrorCode.INVALID_SHC_STRING);
        return undefined;
    }

    // breaks string array of digit pairs into array of numbers: 'shc:/123456...' = [12,34,56]
    const jws: string = digitPairs
        // for each number in array, add an offset and convert to a char in the base64 range
        .map((c: string) => String.fromCharCode(Number.parseInt(c) + b64Offset))
        // merge the array into a single base64 string
        .join('');

    return jws;
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo, log: Log): Promise<string | undefined> {

    let svgBuffer;
    //const result = new ResultWithErrors();

    switch (fileInfo.fileType) {

        case 'svg':
            svgBuffer = await svgToImageBuffer(fileInfo.buffer.toString(), log);
            return svgBuffer && decodeQrBuffer(svgBuffer, log);

        case 'shc':
            return Promise.resolve(shcToJws(fileInfo.buffer.toString(), log));

        case 'png':
            return decodeQrBuffer(fileInfo.buffer, log);

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
