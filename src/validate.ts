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
import { FhirOptions, ValidationProfiles } from './fhirBundle';
import { CliOptions } from './shc-validator';
import { clearTrustedIssuerDirectory, setTrustedIssuerDirectory } from './issuerDirectory';


export type ValidationType = "qr" | "qrnumeric" | "healthcard" | "fhirhealthcard" | "jws" | "jwspayload" | "fhirbundle" | "jwkset";


async function processOptions(options: CliOptions) {

    if (options.clearKeyStore === true) {
        keys.clear();
    }

    if (options.jwkset) {
        const keys = utils.loadJSONFromFile<KeySet>(options.jwkset);
        await validateKey(keys);
    }

    FhirOptions.ValidationProfile =
        options.profile ?
            ValidationProfiles[options.profile as keyof typeof ValidationProfiles] :
            FhirOptions.ValidationProfile = ValidationProfiles['any'];

    if (options.directory) {
        await setTrustedIssuerDirectory(options.directory);
    } else {
        clearTrustedIssuerDirectory();
    }

}


/** Validate the issuer key */
export async function validateKey(keySet: KeySet, log: Log = new Log('Validate Key-Set')): Promise<Log> {
    return (await verifyAndImportHealthCardIssuerKey(keySet, log));
}


/** Validates SMART Health Card */
export async function validateCard(fileData: FileInfo[], options: CliOptions): Promise<Log> {

    let result: Log;

    await processOptions(options);

    switch (options.type.toLocaleLowerCase()) {

        case "qr":
            result = await image.validate(fileData);
            break;

        case "qrnumeric":
            result = await qr.validate(fileData.map((fi) => fi.buffer.toString('utf-8')));
            break;

        case "healthcard":
            result = await healthCard.validate(fileData[0].buffer.toString());
            if (fileData[0].ext !== '.smart-health-card') {
                result.warn("Invalid file extension. Should be .smart-health-card.", ErrorCode.INVALID_FILE_EXTENSION);
            }
            break;

        case "fhirhealthcard":
            result = await fhirHealthCard.validate(fileData[0].buffer.toString());
            break;

        case "jws":
            result = await jws.validate(fileData[0].buffer.toString());
            break;

        case "jwspayload":
            result = await jwsPayload.validate(fileData[0].buffer.toString());
            break;

        case "fhirbundle":
            result = await fhirBundle.validate(fileData[0].buffer.toString());
            break;

        default:
            return Promise.reject(`Invalid type : ${options.type}`);
    }

    return result;
}
