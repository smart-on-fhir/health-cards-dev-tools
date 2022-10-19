// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import jsQR from 'jsqr';
import { ErrorCode } from './error';
import Log from './logger';
import { FileImage, FileInfo } from './file';
import * as qr from './qr';
import * as shlink from "./shlink";
import fs from 'fs';
import { create } from 'qrcode';
import { ByteChunk, Chunk } from 'jsqr/dist/decoder/decodeData';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import path from 'path';
import { IOptions } from './options';


// the size of images generated from svg data 
const svgImageWidth = 600;


export async function validate(images: FileInfo[], options: IOptions): Promise<Log> {
    const log = new Log(images.length > 1 ? "QR images (" + images.length.toString() + ")" : "QR image");

    let shcStrings: SHC[] = [];

    for (let i = 0; i < images.length; i++) {
        const shc = await decode(images[i], log);
        if (shc === undefined) return log;
        shcStrings.push(shc);
        log.info(images[i].name + " decoded");
        log.debug(images[i].name + " = " + shc);
    }

    if (options.cascade) {
        const shlinkStrings = shcStrings.filter((str) => !isShc(str));
        shcStrings = shcStrings.filter((str) => isShc(str));

        shcStrings.length && log.child.push(await qr.validate(shcStrings, options));

        for (const shlinkString of shlinkStrings) {
            log.child.push(await shlink.validate(shlinkString, options));
        }
    }

    return log;
}


// takes file path to QR data and returns base64 data
async function decode(fileInfo: FileInfo, log: Log): Promise<string | undefined> {

    switch (fileInfo.fileType) {


        // eslint-disable-next-line no-fallthrough
        case 'png':
        case 'jpg':
        case 'bmp':
        case 'svg':
            return Promise.resolve(decodeQrBuffer(fileInfo, log));

        default:
            log.fatal("Unknown data in file", ErrorCode.UNKNOWN_FILE_DATA);
            return Promise.resolve(undefined);
    }

}


export async function getImageBuffer(fileInfo: FileInfo): Promise<FileImage> {

    let s: sharp.Sharp;

    if (fileInfo.fileType === 'bmp') {
        s = importBmp24(fileInfo.path);
    } else {
        s = sharp(fileInfo.path);
    }

    // we need to preserve the svg density parameter to deal with a sharp scaling bug
    const metadata = await s.metadata();

    const { data, info } = await s.raw().ensureAlpha().toBuffer({ resolveWithObject: true })
        .catch((err) => {
            throw err;
        });

    return {
        data: data,
        width: info.width,
        height: info.height,
        density: metadata.density
                }
}


// Decode QR image buffer to base64 string
function decodeQrBuffer(fileInfo: FileInfo, log: Log): string | undefined {

    const result: JWS | undefined = undefined;
    const data = fileInfo.image;

    if (!data) {
        log.fatal('Could not read image data from : ' + fileInfo.name);
        return undefined;
    }

    let code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);

    if(!code) log.debug(`failed to decode ${fileInfo.name}`);

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

    // decide whether is a shc or shlink or unknown

    if (!code.chunks) {
        log.fatal(`No segments in QR code. Expected 1-2`, ErrorCode.INVALID_QR);
        return undefined;
    } 

    // if this is an 'shc' check for 2 correct segments
    // this check will fail on a really poorly formed shc
    if (isShc(code.data)) {
        if (code.chunks.length !== 2) {
            log.error(
                `Wrong number of segments in QR code: found ${code.chunks.length}, expected 2` +
                    `\nSegments types: ${code.chunks.map((chunk, i) => `${i + 1}: ${chunk.type}`).join("; ")}`,
                ErrorCode.INVALID_QR
            );
        } else {
            if (code.chunks[0].type !== "byte") {
                // unlikely, since 'shc:/' can only be legally encoded as with byte mode;
                // was not able to create test case for this
                log.error(
                    `Wrong encoding mode for first QR segment: found ${code.chunks[0].type}, expected "byte"`,
                    ErrorCode.INVALID_QR
                );
            }
            if (code.chunks[1].type !== "numeric") {
                log.error(
                    `Wrong encoding mode for second QR segment: found ${code.chunks[0].type}, expected "numeric"`,
                    ErrorCode.INVALID_QR
                );
            }

            // let's make sure the QR code's version is tight
            try {
                const qrCode = create(code.data, { errorCorrectionLevel: "low" });
                if (qrCode.version < code.version) {
                    log.warn(
                        `QR code has version ${code.version}, but could have been created with version ${qrCode.version} (with low error-correcting level). Make sure the larger version was chosen on purpose (e.g., not hardcoded).`,
                        ErrorCode.INVALID_QR_VERSION
                    );
                }
            } catch (err) {
                log.warn(`Can't re-create QR to check optimal version choice: ${(err as Error).message})`);
            }
        }
    } else /* not a 'shc' -- assuming 'shlink' */ {
        if (code.chunks.length !== 1) {
            log.warn(
                `Additional segments found in QR code: found ${code.chunks.length}, expected 1` +
                    `\nSegments types: ${code.chunks.map((chunk, i) => `${i + 1}: ${chunk.type}`).join("; ")}`,
                ErrorCode.INVALID_QR
            );
        } else {
            // When sharing a SHLink via QR code, the following recommendations apply:
            // Create the QR with Error Correction Level Q
            // Include the SMART Logo on a white background over the center of the QR, scaled to occupy 15% of the image area

            // There does not appear to be a 'Error Correction Level' we can query from the decoder
            // so we do nothing and continue assuming this is an shlink
        }
    }

    // the proper formatting of the QR code data is done later in the pipeline

    return code.data;
}

// used to create test images (jpg, png, etc) from a base svg file
export async function svgToQRImage(fileInfo: FileInfo): Promise<void> {

    if (!fileInfo.image?.data) throw new Error('File contains no image data.');
    if (!fileInfo.image.density) throw new Error('svgToQRImage density missing');

    // the 'sharp' package doesn't properly handle scaling svg image and results in blurry conversions to image.
    // a workaround is to compute the proper new density and use it when opening the svg.
    // this will give very clear images, when correct.
    const density = (fileInfo.image.density * svgImageWidth) / fileInfo.image.width;

    const s = sharp(fileInfo.path, { density: density })
        .resize(svgImageWidth, svgImageWidth);

    const filePath = path.join(path.dirname(fileInfo.path), fileInfo.name);

    await Promise.all([
        s.toFile(`${filePath}.bmp`),
        s.toFile(`${filePath}.png`),
        s.toFile(`${filePath}.jpg`)
    ])
        .catch(err => { console.error(err); });
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
        const data = scaleImage(image, s);
        code = jsQR(new Uint8ClampedArray(data.data.buffer), data.width, data.height);
        log && log.debug(`image scaled to ${s.toFixed(1)} : ${code ? 'succeeded' : 'failed'}`);
        if (code) break;
    }

    return code;
}


// convert a 24-bit uncompressed bitmap to a Sharp object
// sharp does not support importing bitmaps (bizarre - I even asked the dev)
function importBmp24(filePath: string): sharp.Sharp {

    const buff = fs.readFileSync(filePath);
    const dv = new DataView(buff.buffer, buff.byteOffset, buff.byteLength);
    const uint32 = (offset: number) => dv.getUint32(offset, true);

    if (
        buff.toString('ascii', 0, 2) !== 'BM' ||  // must start with 'BM'
        uint32(2) !== fs.statSync(filePath).size ||  // bytes 2-5 must match the file size
        dv.getUint16(28, true) !== 24 // bits-per-pixel must be 24
    ) throw new Error('invalid 24-bit bitmap');

    return sharp(
        // .reverse() corrects BGR to RGB and the rows being stored bottom-to-top
        // .slice(0) needed to make new pixel buffer copy as sharp does not respect the offset/length properties of an ArrayBuffer
        (new Uint8Array(buff.buffer, buff.byteOffset + uint32(10), uint32(34))).reverse().slice(0),
        { raw: { width: uint32(18), height: uint32(22), channels: 3 } }
    )
        .flop() /* correct horizontal flip from .reverse() */
        .ensureAlpha();
}


function isShc(text: string) : boolean {
    return /^[^\w]*shc[^\w]/i.test(text);
}


// this is a utility function to generate qr codes that can be decoded only using tryScaling.
// it is not used to do any validation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function searchScaling(image: FileImage) {

    const scaleMin = 0.2;
    let code = null;
    let data;
    let s;

    // find a scale of image that won't decode 
    for (s = 0.95; s >= scaleMin; s -= 0.01) {

        console.log(`trying ${s.toFixed(2)}`);

        data = scaleImage(image, s);
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
