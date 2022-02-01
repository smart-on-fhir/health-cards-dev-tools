// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import { verifyAndImportHealthCardIssuerKey } from './shcKeyValidator';
import { FileInfo } from './file';
import { ErrorCode } from './error';
import * as healthCard from './healthCard';
import * as fhirHealthCard from './fhirHealthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import * as qr from './qr';
import * as image from './image';
import keys, { KeySet } from './keys';
import * as utils from './utils';
import { ValidationProfiles } from './fhirBundle';
import { CliOptions } from './shc-validator';
import { clearTrustedIssuerDirectory, setTrustedIssuerDirectory } from './issuerDirectory';
import { IOptions, setOptions } from './options';


export type ValidationType = "qr" | "qrnumeric" | "healthcard" | "fhirhealthcard" | "jws" | "jwspayload" | "fhirbundle" | "jwkset";


async function processOptions(options: CliOptions) : Promise<IOptions> {

    const defaultOptions = setOptions();

    if (options.clearKeyStore === true) {
        keys.clear();
    }

    if (options.jwkset) {
        const keys = utils.loadJSONFromFile<KeySet>(options.jwkset);
        await validateKey(keys);
    }

    defaultOptions.profile = 
        options.profile ?
            ValidationProfiles[options.profile as keyof typeof ValidationProfiles] :
            ValidationProfiles.any;

    if (options.directory) {
        await setTrustedIssuerDirectory(options.directory);
    } else {
        clearTrustedIssuerDirectory();
    }

    return defaultOptions;
}


/** Validate the issuer key */
export async function validateKey(keySet: KeySet, log: Log = new Log('Validate Key-Set')): Promise<Log> {
    return (await verifyAndImportHealthCardIssuerKey(keySet, log));
}


/** Validates SMART Health Card */
export async function validateCard(fileData: FileInfo[], cliOptions: CliOptions): Promise<Log> {

    let result: Log;

    const options : IOptions = await processOptions(cliOptions);

    switch (cliOptions.type.toLocaleLowerCase()) {

        case "qr":
            result = await image.validate(fileData, options);
            break;

        case "qrnumeric":
            result = await qr.validate(fileData.map((fi) => fi.buffer.toString('utf-8')), options);
            break;

        case "healthcard":
            result = await healthCard.validate(fileData[0].buffer.toString(), options);
            if (fileData[0].ext !== '.smart-health-card') {
                result.warn("Invalid file extension. Should be .smart-health-card.", ErrorCode.INVALID_FILE_EXTENSION);
            }
            break;

        case "fhirhealthcard":
            result = await fhirHealthCard.validate(fileData[0].buffer.toString(), options);
            break;

        case "jws":
            result = await jws.validate(fileData[0].buffer.toString(), options);
            break;

        case "jwspayload":
            result = await jwsPayload.validate(fileData[0].buffer.toString(), options);
            break;

        case "fhirbundle":
            result = await fhirBundle.validate(fileData[0].buffer.toString(), options);
            break;

        default:
            return Promise.reject(`Invalid type : ${cliOptions.type}`);
    }

    return result;
}
