// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import { getImageBuffer } from './image';


/*

  Reads a user file from the file system and returns an object with the data buffer and additional metadata.
  If we can get all the data/metadata we need here, then ideally, none of the other code needs to deal with the file system.

  This is used for all user supplied input files:

  shc                   decoded qr code data
  svg                   qr code as vector data
  png                   qr code as an image
  bmp                   "
  gif                   "
  tif                   "
  jpg                   "
  jws                   serialized json web signature (jws)
  smart-health-card     json with a verifiable credential array
  fhir-bundle           json FHIR data
  keys                  json with an array of keys

*/

export interface FileInfo {
    name: string,
    path: string,
    ext: string,
    buffer: Buffer,
    fileType: string | undefined,
    image?: FileImage
}


export interface FileImage {
    data: Buffer, height: number, width: number, density?: number
}


// Reads a file and determines what kind of file it is
export async function getFileData(filepath: string): Promise<FileInfo> {

    if (!fs.existsSync(filepath)) {
        throw new Error("File not found : " + filepath);
    }

    // read the file data
    const buffer: Buffer = fs.readFileSync(filepath);

    // collect file metadata
    const fileInfo: FileInfo = {
        name: path.basename(filepath, path.extname(filepath)),
        path: path.resolve(filepath),
        ext: path.extname(filepath),
        buffer: buffer,
        fileType: fileType(buffer)
    };

    // get the image data if this is an image file
    switch (fileInfo.fileType) {
        case 'png':
        case 'jpg':
        case 'gif':
        case 'tif':
        case 'bmp':
        case 'svg':
            fileInfo.image = await getImageBuffer(fileInfo);
            break;
    }

    return fileInfo;
}


// determine the type of a file by examining its contents
function fileType(buffer: Buffer): string | undefined {

    const hex = (start: number, end?: number) => buffer.toString('hex', start, end);
    const ascii = (start: number, end?: number) => buffer.toString('ascii', start, end);

    if (buffer.length < 8) return undefined;

    if (ascii(0, 2) === 'BM' && buffer.readUInt32LE(2) === buffer.length) return 'bmp';

    if (hex(0, 2) === 'ffd8' && buffer.subarray(-2).toString('hex') === 'ffd9') return 'jpg';

    if (hex(0, 8) === '89504e470d0a1a0a') return 'png';

    if (/GIF8(9|7)a/.test(ascii(0, 6))) return 'gif';

    if (hex(0, 4) === '49492a00') return 'tif';

    // we didn't match it to an image type, try text

    const fileText = buffer.toString('utf-8');

    if (/^\s*<svg/.test(fileText)) return 'svg';

    if (/^\s*shc:/.test(fileText)) return 'shc';

    if (/^\s*[\w-]+\.[\w-]+\.[\w-]+\s*$/.test(fileText)) return 'jws';

    try {
        if (JSON.parse(fileText)) return 'json';
    } catch { /*empty*/ }

    return undefined;
}
