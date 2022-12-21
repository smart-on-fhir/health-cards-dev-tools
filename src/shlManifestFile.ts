import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import { get, parseJson, unexpectedProperties } from "./utils";
import * as jose from "node-jose";
import * as healthCard from "./healthCard";

export async function validate(shlinkFile: string, options: IOptions): Promise<Log> {
    const log = new Log(`SHL-File ${options.index}`);
    //const index = options.index;

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

    let encrypted;

    if (!file.embedded && !file.location) {
        log.error(
            `Manifest file must contain 'embedded' and/or 'location' property`,
            ErrorCode.SHLINK_VERIFICATION_ERROR
        );
    }

    if (!file.embedded) {
        log.info(`Retrieving file payload from location ${file.location as string}`);

        encrypted = await get(file.location as string).catch((err: Error) => {
            log.error(`Manifest file location download error : ${err.toString()}`, ErrorCode.SHLINK_VERIFICATION_ERROR);
        });


        log.debug(`Encrypted\n${JSON.stringify(encrypted, null, 2)}`);
    } else {
        encrypted = file.embedded;
    }

    if (!encrypted || typeof encrypted !== "string") {
        return log.error(`Manifest file download invalid`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    }

    const key = await jose.JWK.asKey({
        alg: "A256GCM",
        ext: true,
        k: options.decryptionKey,
        key_ops: ["decrypt"],
        kty: "oct",
    }).catch(() => {
        log.error(`failed to import key ${options.decryptionKey}`, ErrorCode.SHLINK_VERIFICATION_ERROR);
    });

    if (key) {
        log.info(`Decrypting`);
        const decryptor = jose.JWE.createDecrypt(key);

        let payload;

        try {
            payload = (await decryptor.decrypt(encrypted)).payload;
        } catch (_err) {
            return log.fatal(`Decryption failed`, ErrorCode.SHLINK_VERIFICATION_ERROR);
        }

        const shc = Buffer.from(payload).toString("utf-8");

        log.debug(`Decrypted\n${JSON.stringify(shc, null, 2)}`);

        if (options.cascade && file.contentType == 'application/smart-health-card') {
            log.child.push(await healthCard.validate(shc, options));
        }
    }

    return log;
}
