// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import svg2img from 'svg2img';   // svg files to image buffer
import jsQR from 'jsqr';         // qr image decoder
import { ErrorCode } from './error';
import Log from './logger';
import { FileImage, FileInfo } from './file';
import * as qr from './qr';
import { PNG } from 'pngjs';
import fs from 'fs';
import Jimp from 'jimp';
import { create, toFile, QRCodeSegment } from 'qrcode';
import { ByteChunk, Chunk } from 'jsqr/dist/decoder/decodeData';
import jpeg from 'jpeg-js';

export async function validate(images: FileInfo[]): Promise<Log> {

    const log = new Log(
        images.length > 1 ?
            'QR images (' + images.length.toString() + ')' :
            'QR image');


    const shcStrings: SHC[] = [];

    for (let i = 0; i < images.length; i++) {
        const shc = await decode(images[i], log);
        if (shc === undefined) return log;
        shcStrings.push(shc);
        log.info(images[i].name + " decoded");
        log.debug(images[i].name + ' = ' + shc);
    }


    log.child.push((await qr.validate(shcStrings)));


    return log;
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo, log: Log): Promise<string | undefined> {

    let svgBuffer;

    switch (fileInfo.fileType) {

        case 'svg': // TODO: move this processing to file.ts, with all others? would require some refactoring to catch and log errors 
            svgBuffer = await svgToImageBuffer(fileInfo.buffer.toString(), log);
            fileInfo.image = PNG.sync.read(svgBuffer);
            fs.writeFileSync(fileInfo.path + '.png', svgBuffer);

        // eslint-disable-next-line no-fallthrough
        case 'png':
        case 'jpg':
        case 'bmp':
            return Promise.resolve(decodeQrBuffer(fileInfo, log));

        default:
            log.fatal("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
            return Promise.resolve(undefined);
    }

}


// the svg data is turned into an image buffer. these values ensure that the resulting image is readable
// by the QR image decoder. 300x300 fails while 400x400 succeeds 
const svgImageWidth = 600;


// Converts a SVG file into a QR image buffer (as if read from a image file)
async function svgToImageBuffer(svgPath: string, log: Log): Promise<Buffer> {

    // TODO: create a test that causes failure here
    return new Promise<Buffer>((resolve, reject) => {
        svg2img(svgPath, { width: svgImageWidth, height: svgImageWidth },
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
function decodeQrBuffer(fileInfo: FileInfo, log: Log): string | undefined {

    const result: JWS | undefined = undefined;

    let data = fileInfo!.image;

    if (!data) {
        log.fatal('Could not read image data from : ' + fileInfo.name);
        return undefined;
    }

    let code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);

    // if we could not decode, try scaling the image
    code = code || tryScaling(data, log);

    if (code == null) {
        log.fatal('Could not decode QR image from : ' + fileInfo.name, ErrorCode.QR_DECODE_ERROR);
        return result;
    }

    if (code.version > 22) {
        log.error(`QR code version of ${code.version} is larger than the maximum allowed of 22`, ErrorCode.INVALID_QR_VERSION);
    }

    // check chunks. Note: jsQR calls chunks and type what the SMART Health Cards spec call segments and mode,
    // we use the later in error messages
    code.chunks.forEach((c,i) =>
        {
            const chunkText = (c as Chunk).text || (c as ByteChunk).bytes?.join(',') || "<can't parse>";
            log.debug(`segment ${i+1}: type: ${c.type}, content: ${chunkText}`);
        });
    if (!code.chunks || code.chunks.length !== 2) {
        log.error(`Wrong number of segments in QR code: found ${code.chunks.length}, expected 2` + 
        `\nSegments types: ${code.chunks.map((chunk,i) => `${i+1}: ${chunk.type}`).join("; ")}`, ErrorCode.INVALID_QR);
    } else {
        if (code.chunks[0].type !== 'byte') {
            // unlikely, since 'shc:/' can only be legally encoded as with byte mode;
            // was not able to create test case for this
            log.error(`Wrong encoding mode for first QR segment: found ${code.chunks[0].type}, expected "byte"`, ErrorCode.INVALID_QR);
        }
        if (code.chunks[1].type !== 'numeric') {
            log.error(`Wrong encoding mode for second QR segment: found ${code.chunks[0].type}, expected "numeric"`, ErrorCode.INVALID_QR);
        }

        // let's make sure the QR code's version is tight
        try {
            const qrCode = create(code.data, { errorCorrectionLevel: 'low' });
            if (qrCode.version < code.version) {
                log.warn(`QR code has version ${code.version}, but could have been created with version ${qrCode.version} (with low error-correcting level). Make sure the larger version was chosen on purpose (e.g., not hardcoded).`, ErrorCode.INVALID_QR_VERSION);
            }
        } catch (err) {
            log.warn(`Can't re-create QR to check optimal version choice: ${(err as Error).message})`);
        }
    }

    // the proper formatting of the QR code data is done later in the pipeline

    return code.data;
}


export function svgToQRImage(filePath: string): Promise<unknown> {

    const baseFileName = filePath.slice(0, filePath.lastIndexOf('.'));

    return new
        Promise<Buffer>((resolve, reject) => {
            svg2img(filePath, { width: 600, height: 600 },
                (error: unknown, buffer: Buffer) => {
                    error ? reject("Could not create image from svg") : resolve(buffer);
                });
        })
        .then((buffer) => {
            fs.writeFileSync(baseFileName + '.png', buffer);
            return Jimp.read(baseFileName + '.png');
        })
        .then(png => {
            return Promise.all([
                png.write(baseFileName + '.bmp'),
                png.grayscale().quality(100).write(baseFileName + '.jpg')
            ]);
        })
        .catch(err => { console.error(err); });
}


export async function dataToQRImage(path: string, data: QRCodeSegment[]) : Promise<void> {

    await toFile(path, data, { type: 'png', errorCorrectionLevel: 'low' })
        .catch((error) => {
            throw error;
        });

}

// takes an image of raw RGBA data and scales it to a new size
function scaleImage(image: FileImage, scale: number) {

    const h = Math.floor(image.height * scale);
    const w = Math.floor(image.width * scale);
    const si = 1.0 / scale;
    const nb = new Uint32Array(h * w);
    const ob = new Uint32Array(image.data.buffer);

    for (let i = 0; i < nb.length; i++) {
        nb[i] = ob[Math.floor((i / w) * si) * image.width + Math.floor((i % w) * si)];
    }

    return { data: Buffer.from(nb.buffer), height: h, width: w };
}

// try scaling the image until it decodes; this works for some poorly scaled qr images
function tryScaling(image: FileImage, log?: Log) {

    const scaleMin = 0.5;
    const scaleMax = 2.0;
    let code = null;

    for (let s = scaleMin; s <= scaleMax + 0.01; s += 0.1) {
        const data = scaleImage(image as FileImage, s);
        code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);
        log && log.debug(`image scaled to ${s.toFixed(1)} : ${code ? 'succeeded' : 'failed'}`);
        if (code) break;
    }

    return code;
}

// this is a utility function to generate qr codes that can be decoded only using tryScaling.
// it is not used to do any validation
function searchScaling(image: FileImage) {

    const scaleMin = 0.2;
    let code = null;
    let data;
    let s;

    // find a scale of image that won't decode 
    for (s = 0.95; s >= scaleMin; s -= 0.01) {

        console.log(`trying ${s.toFixed(2)}`);

        data = scaleImage(image as FileImage, s);
        code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);

        // image failed to decode at s; now see if tryScaling() can make it work
        if (!code) {

            console.log(`${s.toFixed(2)} failed`);
            code = tryScaling(data as FileImage);

            // this should be an image that requires scaling to decode; save it.
            if (code) {
                const jpg = jpeg.encode(data as FileImage, 100);
                fs.writeFileSync(`scaled.${s.toFixed(2)}.jpg`, jpg.data);
            }
        }
    }
}
