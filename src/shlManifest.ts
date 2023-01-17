// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import { parseJson, unexpectedProperties } from "./utils";
import * as shlManifestFile from "./shlManifestFile";

export async function validate(shlinkManifestJson: string, options: IOptions): Promise<Log> {
    const log = new Log("SHL-Manifest");

    const manifest = parseJson<ShlinkManifest>(shlinkManifestJson);

    if (!manifest) {
        return log.fatal(`Cannot decode payload as JSON`, ErrorCode.INVALID_SHLINK);
    }

    const files = manifest?.files;

    if (!(files instanceof Array) || files.length === 0) {
        return log.fatal(`manifest files property missing or not Array`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    }

    log.debug(`Manifest:\n${JSON.stringify(manifest, null, 2)}`);

    const unexpectedProps = unexpectedProperties(manifest as unknown as Record<string, unknown>, ["files"]);
    if (unexpectedProps.length) {
        log.warn(
            `Unexpected properties on manifest : ${unexpectedProps.join(",")}`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    log.info(`${files.length} shlink files returned.`);

    if (options.cascade) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            log.child.push(await shlManifestFile.validate(JSON.stringify(file), { ...options, index: i }));
        }
    }
    return log;
}
