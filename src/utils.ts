// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import pako from 'pako';
import jose from 'node-jose';
import execa from 'execa';

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
        const result = execa.commandSync("openssl version");
        return (result.exitCode == 0);
    } catch (err) {
        return false;
    }
}

//
// get an object property using a string path
//
export function propPath(object: Record<string, unknown>, path: string): string | undefined {
    const props = path.split('.');
    let val = object;
    for (let i = 1; i < props.length; i++) {
        val = val[props[i]] as Record<string, Record<string, unknown>>;
        if(val instanceof Array) val = val.length === 0 ? val : val[0] as Record<string, Record<string, unknown>>;
        if (val === undefined) return val;
    }
    return val as unknown as string;
}

//
// walks through an objects properties calling a callback with a path for each.
//
export function walkProperties(obj: Record<string, unknown>, path: string[], callback: (o: Record<string, unknown>, p: string[]) => void): void {

    if (obj instanceof Array) {
        for (let i = 0; i < obj.length; i++) {
            const element = obj[i] as Record<string, unknown>;
            if (element instanceof Object) {
                walkProperties(element, path.slice(0), callback);
            }
        }
        if(obj.length === 0) callback(obj, path);
        return;
    }

    callback(obj, path);

    if (!(obj instanceof Object)) return;

    for (const propName in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, propName)) {
            const prop = obj[propName];
            path.push(propName);
            walkProperties(prop as Record<string, unknown>, path.slice(0), callback);
            path.pop();
        }
    }

    return;
}
