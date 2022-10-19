// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from "./logger";
import { verifyAndImportHealthCardIssuerKey } from "./shcKeyValidator";
import { FileInfo } from "./file";
import { ErrorCode } from "./error";
import * as healthCard from "./healthCard";
import * as fhirHealthCard from "./fhirHealthCard";
import * as jws from "./jws-compact";
import * as jwsPayload from "./jws-payload";
import * as fhirBundle from "./fhirBundle";
import * as qr from "./qr";
import * as image from "./image";
import * as shlink from "./shlink";
import * as shlinkPayload from "./shlPayload";
import * as shlManifest from "./shlManifest";
import * as shlfile from "./shlManifestFile";
import keys, { KeySet } from "./keys";
import * as utils from "./utils";
import { clearTrustedIssuerDirectory, setTrustedIssuerDirectory } from "./issuerDirectory";
import { IOptions } from "./options";

/** Validate the issuer key */
export async function validateKey(
    keySet: KeySet,
    validationTime = "",
    log: Log = new Log("Validate Key-Set")
): Promise<Log> {
    return await verifyAndImportHealthCardIssuerKey(keySet, validationTime, log);
}

/** Validates SMART Health Card */
export async function validateCard(fileData: FileInfo[], artifact: ValidationType, options: IOptions): Promise<Log> {
    let result: Log;

    if (options.clearKeyStore === true) {
        keys.clear();
    }

    if (options.jwkset) {
        const keys = utils.loadJSONFromFile<KeySet>(options.jwkset);
        await validateKey(keys, options.validationTime);
    }

    if (options.issuerDirectory) {
        await setTrustedIssuerDirectory(options.issuerDirectory);
    } else {
        clearTrustedIssuerDirectory();
    }

    switch ((artifact as string).toLocaleLowerCase()) {
        case "qr":
            result = await image.validate(fileData, options);
            break;

        case "qrnumeric":
            result = await qr.validate(
                fileData.map((fi) => fi.buffer.toString("utf-8")),
                options
            );
            break;

        case "healthcard":
            result = await healthCard.validate(fileData[0].buffer.toString(), options);
            if (fileData[0].ext !== ".smart-health-card") {
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

        case "shlink":
            result = await shlink.validate(fileData[0].buffer.toString(), options);
            break;

        case "shlpayload":
            result = await shlinkPayload.validate(fileData[0].buffer.toString(), options);
            break;

        case "shlmanifest":
            result = await shlManifest.validate(fileData[0].buffer.toString(), options);
            break;

        case "shlfile":
            result = await shlfile.validate(fileData[0].buffer.toString(), options);
            break;

        default:
            return Promise.reject(`Invalid type : ${artifact as string}`);
    }

    return result;
}
