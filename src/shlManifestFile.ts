// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import { get, parseJson, unexpectedProperties, isUrl, isJwe } from "./utils";
import * as jwe from "./jwe-compact";
import { HTTPError } from "got";
import { URLSearchParams } from "url";

export async function validate(shlinkFile: string, options: IOptions): Promise<Log> {
    const log = new Log(`SHL-File ${options.index}`);

    const file = parseJson<ShlinkFile>(shlinkFile);

    if (!file) {
        return log.fatal(`Cannot decode manifest file as JSON`, ErrorCode.INVALID_SHLINK);
    }

    log.debug(`File\n${JSON.stringify(file, null, 2)}`);

    const unexpectedProps = unexpectedProperties(file as unknown as Record<string, unknown>, [
        "embedded",
        "location",
        "contentType",
    ]);

    if (unexpectedProps.length) {
        log.warn(
            `Unexpected properties on manifest file : ${unexpectedProps.join(",")}`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    const allowedContentTypes = [
        "application/smart-health-card",
        "application/smart-api-access",
        "application/fhir+json",
    ];

    if (!file.contentType) {
        log.error(`Manifest file must contain 'contentType'`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    } else {
        if (allowedContentTypes.includes(file.contentType) === false) {
            log.error(
                `'contentType' must be either ${allowedContentTypes.join(" | ")}`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
        }
    }

    let encrypted;

    if (!file.embedded && !file.location) {
        return log.fatal(
            `Manifest file must contain 'embedded' and/or 'location' property`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    if (file.location && isUrl(file.location) === false) {
        return log.error(`file.location is not a valid HTTPS url`, ErrorCode.SHLINK_NOT_HTTPS_URL);
    }

    if (file.embedded && isJwe(file.embedded) === false) {
        log.error(`file.embedded is not JWE`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    }

    options = { ...options, shlFile: file };

    if (options.cascade) {
        if (file.location) {
            log.info(`Retrieving file payload from location ${file.location}`);

            encrypted = await downloadManifestFile(file, log);

            log.debug(`Encrypted\n${encrypted}`);
            if (file.embedded && encrypted !== file.embedded) {
                log.error(
                    `File downloaded from 'location' does not equal the 'embedded' file contents`,
                    ErrorCode.SHLINK_VERIFICATION_ERROR
                );
            }
        } else {
            log.info(`Retrieving 'embedded' file payload`);
            encrypted = file.embedded;
        }

        if (!encrypted || typeof encrypted !== "string") {
            return log.error(`Manifest file download invalid`, ErrorCode.SHLINK_VERIFICATION_ERROR);
        }

        // jwe.validate requires the shlFile to read the contentType property
        log.child.push((await jwe.validate(encrypted, { ...options, shlFile: file })).log);
    }

    return log;
}

export async function downloadManifestFile(params: ShlinkFile, log: Log): Promise<string> {
    if (!params.location || !isUrl(params.location)) {
        log.fatal(
            `Manifest file download error: 'location' property is not valid URL or is missing`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
        return "";
    }

    return await get(params.location).catch((err: HTTPError) => {
        log.fatal(
            `Manifest file download error : ${err.response?.statusCode} ${err.toString()}`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
        return "";
    });
}

export async function downloadDirectFile(params: ShlinkFileDirect, log: Log): Promise<string> {
    if (params.url && isUrl(params.url, false) === false) {
        log.error(`url is not a valid HTTPS url`, ErrorCode.SHLINK_NOT_HTTPS_URL);
    }

    const encrypted = await get(params.url, new URLSearchParams({ recipient: params.recipient })).catch(
        (err: HTTPError) => {
            log.fatal(
                `Manifest file download error : ${err.response?.statusCode} ${err.toString()}`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
            return "";
        }
    );

    if (!encrypted || typeof encrypted !== "string") {
        log.error(`Manifest file download invalid`, ErrorCode.SHLINK_VERIFICATION_ERROR);
        return "";
    }

    return encrypted;
}
