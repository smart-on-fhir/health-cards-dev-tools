// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import { shcKeyValidator } from './shcKeyValidator';
import { FileInfo } from './file';
import { ErrorCode } from './error';
import * as healthCard from './healthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import * as qr from './qr';





/** Validate the issuer key */
export async function validateKey(key: Buffer, log: Log): Promise<void> {

    log.debug('Validating key : ' + key.toString('utf-8'));

    const keyValidator = new shcKeyValidator();

    return keyValidator
        .verifyHealthCardIssuerKey(key)
        .then(() => { return Promise.resolve(); })
        .catch(err => {
            log.error("Error validating issuer key : " + (err as Error).message);
            return Promise.reject();
        });
}


export type ValidationType = "qr" | "qrnumeric" | "healthcard" | "jws" | "jwspayload" | "fhirbundle" | "jwkset";


export class ValidationResult {
    constructor(
        public result: HealthCard | JWS | JWSPayload | FhirBundle | undefined,
        public log: Log
    ) { }
}


/** Validates SMART Health Card */
export async function validateCard(fileData: FileInfo[], type: ValidationType): Promise<ValidationResult> {

    let result: ValidationResult;

    switch (type.toLocaleLowerCase()) {

        case "qr":
            result = await qr.validate(fileData);
            break;

        case "qrnumeric":
            result = await qr.validate(fileData);
            break;

        case "healthcard":
            result = await healthCard.validate(fileData[0].buffer.toString());
            if (fileData[0].ext !== '.smart-health-card') {
                result.log.warn("Invalid file extenion. Should be .smart-health-card.", ErrorCode.INVALID_FILE_EXTENSION);
            }
            break;

        case "jws":
            result = await jws.validate(fileData[0].buffer.toString());
            break;

        case "jwspayload":
            result = jwsPayload.validate(fileData[0].buffer.toString());
            break;

        case "fhirbundle":
            result = fhirBundle.validate(fileData[0].buffer.toString());
            break;

        default:
            return Promise.reject("Invalid type : " + type);
    }

    return result;
}
