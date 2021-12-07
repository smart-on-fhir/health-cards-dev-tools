// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import fileType from 'file-type';
import core from 'file-type/core';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import {decode} from 'bmp-js';

type QRData = "png" | "jpg" | "bmp" | "svg" | "shc" | "unknown";
type FileData = { data: Buffer | string | undefined, type: QRData };


export interface FileInfo {
    name: string,
    path: string,
    ext: string,
    buffer: Buffer,
    fileType: core.FileTypeResult | string | undefined,
    image?: FileImage
}


export interface FileImage {
    data: Buffer, height: number, width: number
}

// Reads a file and determines what kind of file it is
export async function getFileData(filepath: string): Promise<FileInfo> {

    if (!fs.existsSync(filepath)) {
        throw new Error("File not found : " + filepath);
    }

    // read the file data
    const buffer: Buffer = fs.readFileSync(filepath);

    const fileInfo: FileInfo = {
        name: path.basename(filepath),
        path: path.resolve(filepath),
        ext: path.extname(filepath),
        buffer: buffer,
        fileType: await fileType.fromBuffer(buffer)
    };

    if (fileInfo.fileType) {
        if ((fileInfo.fileType as core.FileTypeResult).ext) {
            fileInfo.fileType = (fileInfo.fileType as core.FileTypeResult).ext;
        }
    } else {
        // let's try to determine the type, assuming text files
        const textFileContent = buffer.toString('utf-8');
        if (fileInfo.ext === '.svg' || textFileContent.startsWith("<svg")) {
            fileInfo.fileType = 'svg';
        } else if (textFileContent.startsWith("shc:")) {
            fileInfo.fileType = 'shc';
        }
    }

    switch (fileInfo.fileType) {
        case 'png':
            fileInfo.image = PNG.sync.read(fileInfo.buffer);
            break;
        case 'jpg':
            fileInfo.image = jpeg.decode(buffer, { useTArray: true }) as { data: Buffer, height: number, width: number };
            break;
        case 'bmp':
            fileInfo.image = decode(buffer) as { data: Buffer, height: number, width: number };
            break;
        default:
            break;
    }

    return fileInfo;
}