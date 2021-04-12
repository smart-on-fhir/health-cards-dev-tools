// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import pako from 'pako';
import jose from 'node-jose';
import execa from 'execa';
import { stdout } from 'node:process';

export function parseJson<T>(json: string): T | undefined  {
    try {
        return JSON.parse(json) as T;
    } catch {
        return undefined;
    }
}


export function loadJSONFromFile<T>(filePath: string): T {

    // get absolute file path 
    // just to make it easier to figure out why the file is missing
    filePath = path.resolve(filePath);

    if (!fs.existsSync(filePath)) {
        throw new Error("File not found : " + filePath);
    }

    const fileContent: string = fs.readFileSync(filePath, 'utf8');

    let output: T;

    // check if the file is valid JSON
    try {
        output = JSON.parse(fileContent) as T;
    } catch {
        throw new Error("File not valid JSON : " + filePath);
    }
    return output;

}

export function inflatePayload(verificationResult: jose.JWS.VerificationResult): Buffer {

    // keep typescript happy by extending object with a 'zip' property
    const header = verificationResult.header as {zip: string };
    let payload = verificationResult.payload;

    if (header.zip && header.zip === 'DEF') {
        try {
            payload = Buffer.from(pako.inflateRaw(payload));
        } catch (error) {
            throw new Error("Inflate Failed : " + (error as Error).message);
        }
    }

    return payload;
}

export function isOpensslAvailable(): boolean {
    try {
        const expectedPrefix = 'OpenSSL 1.1.1'; // the x5c validation currently only works with openssl 1.1.1
        const result = execa.commandSync("openssl version");
        return (result.exitCode == 0 &&
                result.stdout.substr(0, expectedPrefix.length) == expectedPrefix);
    } catch (err) {
        return false;
    }
}