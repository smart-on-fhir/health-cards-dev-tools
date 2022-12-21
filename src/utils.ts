// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from "fs";
import got from "got";
import path from "path";
import pako from "pako";
import jose from "node-jose";
import { runCommandSync } from "./command";
import { QRCodeErrorCorrectionLevel, toFile } from 'qrcode';
import * as j from "../testdata/shlTestResponses.json";

export function parseJson<T>(json: unknown): T | undefined {
    try {
        return JSON.parse(json as string) as T;
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

    const fileContent: string = fs.readFileSync(filePath, "utf8");

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
    const header = verificationResult.header as { zip: string };
    let payload = verificationResult.payload;

    if (header.zip && header.zip === "DEF") {
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
        const result = runCommandSync("openssl version");
        return result.exitCode == 0;
    } catch (err) {
        return false;
    }
}

//
// get an object property using a string path
//
export function propPath(object: Record<string, unknown>, path: string): string | undefined {
    const props = path.split(".");
    let val = object;
    for (let i = 1; i < props.length; i++) {
        val = val[props[i]] as Record<string, Record<string, unknown>>;
        if (val instanceof Array) val = val.length === 0 ? val : (val[0] as Record<string, Record<string, unknown>>);
        if (val === undefined) return val;
    }
    return val as unknown as string;
}

//
// walks through an objects properties calling a callback with a path for each.
//
export function walkProperties(
    obj: Record<string, unknown>,
    path: string[],
    callback: (o: Record<string, unknown>, p: string[]) => void
): void {
    if (obj instanceof Array) {
        for (let i = 0; i < obj.length; i++) {
            const element = obj[i] as Record<string, unknown>;
            if (element instanceof Object) {
                walkProperties(element, path.slice(0), callback);
            }
        }
        if (obj.length === 0) callback(obj, path);
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

//
// verifies a value is a number
//
export function isNumeric(n: unknown): boolean {
    return !isNaN(parseFloat(n as string)) && isFinite(n as number);
}

//
// checks object for unexpected properties
//
export function unexpectedProperties(object: Record<string, unknown>, expected: string[]): string[] {
    let property: keyof typeof object;

    const unexpected: string[] = [];

    for (property in object) {
        if (!expected.includes(property)) {
            unexpected.push(property);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _value = object[property];
    }

    return unexpected;
}

//
// get request from url
//
export async function post(url: string, data: Record<string, unknown>): Promise<string> {
    const testData = j as unknown as Record<string, Record<string, string> | string>;

    const testResponse = testData[url];

    if ((testResponse as Record<string, string>)?.["error"]) {
        return Promise.reject((testResponse as Record<string, string>)["error"]);
    } else if (testResponse) {
        return typeof testResponse === "string" ? testResponse : JSON.stringify(testResponse);
    }

    return got.post(url, { json: data }).text();
}

export async function get(url: string): Promise<string> {
    const testData = j as unknown as Record<string, Record<string, string> | string>;

    const testResponse = testData[url];

    if ((testResponse as Record<string, string>)?.["error"]) {
        return Promise.reject((testResponse as Record<string, string>)["error"]);
    } else if (testResponse) {
        return typeof testResponse === "string" ? testResponse : JSON.stringify(testResponse);
    }

    return await got.get(url).text();
}

export function createSHLink(url: string, key: string, flag?: string, label?: string, exp?: number, v?: number): string {
    const payload = {
        url,
        flag,
        key,
        label,
        exp,
        v,
    };
    const link = `shlink:/${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
    return link;
}

export async function qrCode(path: string, data: string, errorCorrectionLevel: QRCodeErrorCorrectionLevel = "low"): Promise<void> {
    return toFile(path, data, { errorCorrectionLevel: errorCorrectionLevel }) as Promise<void>;
}
