import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import * as shlPayload from "./shlPayload";

export async function validate(shlinkText: string, options: IOptions): Promise<Log> {
    const log = new Log("SMART Health Link");

    const regEx = /^(\s*)?(.+?#)?(.+?)\/?([0-9a-zA-Z-_+/]+)(\s*)?$/;

    const shlinkHeader = "shlink:";

    const [match, leadingWhiteSpace, viewer, header, body, trailingWhiteSpace] = [...(regEx.exec(shlinkText) ?? [])];

    if (viewer) log.info(`Viewer: ${viewer}`);

    log.debug(`${JSON.stringify({ match: !!match, leadingWhiteSpace : !!leadingWhiteSpace, viewer: viewer ?? 'none', header, body, trailingWhiteSpace : !!trailingWhiteSpace }, null, 2)}`);

    if (viewer && !/https:\/\/.+?#/.test(viewer)) {
        log.error(`Unexpected viewer format`, ErrorCode.INVALID_SHLINK);
    }

    if (!match) {
        const expectedBody = `^(https://<viewer>#)?${shlinkHeader}/[0-9a-zA-Z-_]+$`;
        return log.fatal(`Invalid shlink : expected ${expectedBody}`, ErrorCode.INVALID_SHLINK);
    }

    if (leadingWhiteSpace || trailingWhiteSpace) {
        log.warn(`SHLink contains leading or trailing whitespace`, ErrorCode.INVALID_SHLINK);
    }

    if (!header) {
        log.error(`Invalid header (${header}.  Expect shlink:/`, ErrorCode.INVALID_SHLINK);
    }

    if (!body) {
        return log.fatal(`Invalid body. Expect [0-9a-zA-Z-_]+ (Base64urlencoded)`, ErrorCode.INVALID_SHLINK);
    }

    if (/[+/]/.test(body)) {
        log.error(`Incorrect base64 format. Expect [0-9a-zA-Z-_]+ (Base64urlencoded)`, ErrorCode.INVALID_SHLINK);
    }

    let decodedText;
    try {
        decodedText = Buffer.from(body, "base64").toString("utf-8");
    } catch (_err) {
        return log.fatal(`Cannot base64 decode body`, ErrorCode.INVALID_NUMERIC_QR);
    }

    log.debug(`Decoded Body:\n${decodedText}`);

    options.cascade && log.child.push((await shlPayload.validate(decodedText, options)));

    return log;
}
