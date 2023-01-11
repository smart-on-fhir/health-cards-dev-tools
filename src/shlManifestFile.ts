import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import { get, parseJson, unexpectedProperties } from "./utils";
import * as jwe from "./jwe-compact";
import { HTTPError } from "got";

export async function validate(shlinkFile: string, options: IOptions): Promise<{ result: string, log: Log }> {
    const log = new Log(`SHL-File ${options.index}`);

    const file = parseJson<ShlinkFile>(shlinkFile);

    if (!file) {
        return { log: log.fatal(`Cannot decode manifest file as JSON`, ErrorCode.INVALID_SHLINK), result: '' };
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

    let encrypted;

    if (!file.embedded && !file.location) {
        log.error(
            `Manifest file must contain 'embedded' and/or 'location' property`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    if (!file.embedded) {
        log.info(`Retrieving file payload from location ${file.location as string}`);
        encrypted = await downloadManifestFile(file.location as string, log)
        log.debug(`Encrypted\n${encrypted}`);
    } else {
        encrypted = file.embedded;
    }

    if (!encrypted || typeof encrypted !== "string") {
        return { log: log.error(`Manifest file download invalid`, ErrorCode.SHLINK_VERIFICATION_ERROR), result: '' };
    }

    options = { ...options, shlFile: file }

    if (options.cascade) {
        // jwe.validate requires the shlFile to read the contentType
        log.child.push((await jwe.validate(encrypted, { ...options, shlFile: file })).log);
    }

    return { log, result: encrypted };
}

export async function downloadManifestFile(url: string, log: Log): Promise<string> {
    const embedded = await get(url).catch((err: HTTPError) => {
        log.fatal(
            `url download error : ${err.response.statusCode} ${err.toString()}`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
        return "";
    });
    return embedded;
}
