// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { HTTPError } from "got";
import { ErrorCode } from "./error";
import Log, { LogLevels } from "./logger";
import { IOptions } from "./options";
import { parseJson, post, unexpectedProperties } from "./utils";
import * as shlManifest from "./shlManifest";
import { downloadDirectFile } from "./shlManifestFile";
import * as jwe from "./jwe-compact";

export async function validate(shlinkPayloadJson: string, options: IOptions): Promise<Log> {
    const log = new Log("SHL-Payload");

    const payload = parseJson<ShlinkPayload>(shlinkPayloadJson);

    if (!payload) {
        return log.fatal(`Cannot decode payload as JSON`, ErrorCode.INVALID_SHLINK);
    }

    if (JSON.stringify(payload) !== shlinkPayloadJson) {
        log.warn(
            `JSON payload not minified (extraneous whitespace and/or formatting)`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    if (typeof payload?.key !== "string" || !/^[0-9a-zA-Z-_]{43}$/.test(payload.key)) {
        log.error(
            `Required 'key' property invalid: key must be 43 character base64urlencoded string`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    if (payload.flag) {
        if (typeof payload.flag !== "string" || !["L", "LP", "P", "U", "LU"].includes(payload.flag)) {
            log.error(
                `Optional 'flag' property invalid: flag must be 'L', 'P', 'LP', 'U', or 'LU'`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
        }
    }

    if (payload.label) {
        if (typeof payload.label !== "string" || payload.label.length > 80) {
            log.error(
                `Optional 'label' property invalid: label must be string with length <= 80`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
        }
    }

    if (payload.exp) {
        if (typeof payload.exp !== "number") {
            log.error(
                `Optional 'exp' property invalid: exp must be a number representing time in Epoch seconds`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
        } else if (Date.now() >= payload.exp * 1000) {
            log.warn(
                `Manifest expired ${new Date(payload.exp * 1000).toLocaleDateString("en-US")}`,
                ErrorCode.SHLINK_VERIFICATION_ERROR
            );
        }
    }

    const unexpectedProps = unexpectedProperties(payload as unknown as Record<string, unknown>, [
        "url",
        "exp",
        "label",
        "flag",
        "key",
        "v",
    ]);
    if (unexpectedProps.length) {
        log.warn(
            `Unexpected properties on payload : ${unexpectedProps.join(",")}`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    // We check the 'url' property last so we can capture errors from the other properties before a 'fatal' exit
    if (typeof payload?.url !== "string") {
        return log.fatal(`Required 'url' property missing or not a string`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    }

    if (!/[0-9A-Za-z-_]{43,}/.test(payload.url)) {
        log.error(
            `Minimum 256-bits of entropy not detected in manifest url (43+ chars for base64urlencoded)`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    log.debug(`Payload\n${JSON.stringify(payload, null, 2)}`);

    let manifest: string;

    if (options.cascade) {
        // U Indicates the SHLink's url resolves to a single encrypted file
        // accessible via GET, bypassing the manifest.

        if (payload.flag === "U" || payload.flag === "LU") {
            log.info(`Retrieving file directly from ${payload.url} (flag === U)`);

            const encrypted: string = await downloadDirectFile(
                { url: payload.url, recipient: "Example SHL Client" },
                log
            ).catch((_err) => {
                log.fatal(`error downloading file ${payload.url} ${(_err as Error).message}`);
                return "";
            });

            if (!encrypted) {
                return log;
            }

            log.child.push(
                (
                    await jwe.validate(encrypted, {
                        ...options,
                        decryptionKey: payload.key,
                        index: 0,
                        shlFile: { contentType: "application/smart-health-card" },
                    })
                ).log
            );

            return log;
        }

        // download the manifest file as text
        manifest = await downloadManifest(
            { url: payload.url, passcode: options.passCode, recipient: "Example SHL Client", embeddedLengthMax: 200 },
            log
        );

        // if we got a fatal error, quit here
        if (log.get(LogLevels.FATAL).length) {
            return log;
        }

        log.info(`Retrieving manifest file from ${payload.url}`);

        log.child.push(await shlManifest.validate(manifest, { ...options, decryptionKey: payload.key }));
    }

    return log;
}

export async function downloadManifest(params: ShlinkManifestRequest, log: Log): Promise<string> {
    const manifest = await post(params.url, params as unknown as Record<string, unknown>).catch((err: HTTPError) => {
        const remainingAttempts =
            parseJson<{ remainingAttempts: number }>(err.response?.body as string)?.remainingAttempts || "unknown";

        switch (err.response.statusCode) {
            case 401: // invalid passcode
                {
                    if (!Number.isInteger(remainingAttempts) || (remainingAttempts as number) < 0) {
                        log.warn(
                            `'remainingAttempts' not returned or is negative (remainingAttempts = ${remainingAttempts})`
                        );
                    }
                    log.fatal(
                        `url download error : 401 invalid passcode : remainingAttempts: ${remainingAttempts}`,
                        ErrorCode.SHLINK_INVALID_PASSCODE
                    );
                }
                break;

            case 404: // SHLink is no longer active
                if (Number.isInteger(remainingAttempts)) {
                    log.warn(`inactive shlink should not return 'remainingAttempts'`);
                }

                log.fatal(
                    `url download error : 404 SHLink is invalid or no longer active`,
                    ErrorCode.SHLINK_VERIFICATION_ERROR
                );
                break;

            case 500:
            default:
                log.fatal(
                    `url download error : ${err.response.statusCode} ${err.toString()}`,
                    ErrorCode.SHLINK_VERIFICATION_ERROR
                );
                break;
        }

        return "";
    });

    return manifest;
}
