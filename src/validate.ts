// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import log, { LogLevels, logger } from './logger';
import color from 'colors';
import { shcKeyValidator } from './shcKeyValidator';
import { FileInfo } from './file';
import { ErrorCode, LogItem, OutputTree } from './error';
import * as healthCard from './healthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import * as qr from './qr';



function list(title: string, items: LogItem[], indent: string, color: (c: string) => string) {

    const results: string[] = [];

    if (items.length === 0) return results;

    results.push(indent + "|");
    results.push([indent, "├─ ", color(title), ' : '].join(''));

    for (let i = 0; i < items.length; i++) {
        const lines = items[i].message.split('\n');
        for (let j = 0; j < lines.length; j++) {
            results.push([indent, '|    ', color(lines[j])].join(''));
        }
    }

    return results;
}

export function formatOutput(outputTree: OutputTree, indent: string): string[] {

    let results: string[] = [];

    results.push(indent + color.bold(outputTree.title));
    indent = '    ' + indent;

    switch (logger.verbosity) {
    case LogLevels.DEBUG:
        results = results.concat(list("Debug", outputTree.get(LogLevels.DEBUG), indent + ' ', color.gray));
        // eslint-disable-next-line no-fallthrough
    case LogLevels.INFO:
        results = results.concat(list("Info", outputTree.get(LogLevels.INFO), indent + ' ', color.white.dim ));
        // eslint-disable-next-line no-fallthrough
    case LogLevels.WARNING:
        results = results.concat(list("Warning", outputTree.get(LogLevels.WARNING), indent + ' ', color.yellow));
        // eslint-disable-next-line no-fallthrough
    case LogLevels.ERROR:
        results = results.concat(list("Error", outputTree.get(LogLevels.ERROR), indent + ' ', color.red));
        // eslint-disable-next-line no-fallthrough
    case LogLevels.FATAL:
        results = results.concat(list("Fatal", outputTree.get(LogLevels.FATAL), indent + ' ', color.red.inverse));
    }

    if (outputTree.child) {
        results.push(indent + ' |');
        results = results.concat(formatOutput(outputTree.child, indent));
    } else {
        makeLeaf(results);
    }

    return results;
}


function makeLeaf(items: string[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].trim()[0] === '├') {
            items[i] = items[i].replace('├', '└');
            break;
        }
        items[i] = items[i].replace('|', ' ');
    }
}


/** Validate the issuer key */
export async function validateKey(key: Buffer): Promise<void> {

    log.debug('Validating key', undefined, key);

    const keyValidator = new shcKeyValidator();

    return keyValidator.verifyHealthCardIssuerKey(key)
        .then(() => { return Promise.resolve(); })
        .catch(err => {
            log.error("Error validating issuer key", undefined, err);
            return Promise.reject();
        });
}

export type ValidationType = "qr" | "qrnumeric" | "healthcard" | "jws" | "jwspayload" | "fhirbundle" | "jwkset";

/** Validates SMART Health Card */
export async function validateCard(fileData: FileInfo, type: ValidationType): Promise<OutputTree> {

    let output: OutputTree | undefined = undefined;

    switch (type.toLocaleLowerCase()) {

    case "qr":
        output = await qr.validate(fileData);
        break;

    case "qrnumeric":
        output = await qr.validate(fileData);
        break;

    case "healthcard":
        output = await healthCard.validate(fileData.buffer.toString());
        if (fileData.ext !== '.smart-health-card') {
            output.warn("Invalid file extenion. Should be .smart-health-card.", ErrorCode.INVALID_FILE_EXTENSION);
        }
        break;

    case "jws":
        output = await jws.validate(fileData.buffer.toString());
        break;

    case "jwspayload":
        output = jwsPayload.validate(fileData.buffer.toString());
        break;

    case "fhirbundle":
        output = fhirBundle.validate(fileData.buffer.toString());
        break;

    default:
        return Promise.reject("Invalid type : " + type);
    }

    return output;
}
