import { ErrorCode } from "./error";
import Log from "./logger";
import { IOptions } from "./options";
import * as jose from "node-jose";
import * as healthCard from "./healthCard";
import { isJwe } from "./utils";


export async function validate(jwe: string, options: IOptions): Promise<{ result: string, log: Log }> {
    const log = new Log(`JWE`);

    if (!options.decryptionKey) {
        return { log: log.fatal(`Decryption failed, "options.decryptionKey" required`, ErrorCode.SHLINK_VERIFICATION_ERROR), result: '' };
    }

    log.debug(`Decryption Key\n${options.decryptionKey}`);

    log.debug(`JWE\n${jwe}`);

    if (!/[\w-]+/g.test(options.decryptionKey)) {
        return {
            log: log.fatal('Failed to parse key as base64url string.', ErrorCode.JSON_PARSE_ERROR),
            result: ''
        };
    }

    if (!isJwe(jwe)) {
        return {
            log: log.fatal('Failed to parse JWE-compact serialization as \'base64url.base64url.base64url.base64url.base64url\' string.', ErrorCode.JSON_PARSE_ERROR),
            result: ''
        };
    }

    log.debug(`Decoded JWE\n${JSON.stringify(decodeJwe(jwe), null, 2)}`);

    const key = await jose.JWK.asKey({
        alg: "A256GCM",
        ext: true,
        k: options.decryptionKey,
        key_ops: ["decrypt"],
        kty: "oct",
    }).catch(() => {
        log.error(`Failed to import key ${options.decryptionKey}`, ErrorCode.SHLINK_VERIFICATION_ERROR);
        return undefined;
    });

    if (!key) return { log, result: '' };

    log.info(`Decrypting`);
    const decryptor = jose.JWE.createDecrypt(key);

    let payload;

    try {
        payload = (await decryptor.decrypt(jwe)).payload;
    } catch (_err) {
        return { log: log.fatal(`Decryption failed`, ErrorCode.SHLINK_VERIFICATION_ERROR), result: '' };
    }

    const decrypted = Buffer.from(payload).toString("utf-8");

    log.debug(`Decrypted\n${decrypted}`);

    if (options.cascade && options.shlFile?.contentType == "application/smart-health-card") {
        log.child.push(await healthCard.validate(decrypted, options));
    }

    return { log, result: decrypted };
}


export function decodeJwe(jwe: string): { header: JWEHeader, encryptedKey: string, iv: string, ciphertext: string, authenticationTag: string } {
    const [header, encryptedKey, iv, ciphertext, authenticationTag] = jwe.split('.');
    return { header : JSON.parse(Buffer.from(header, 'base64url').toString('utf-8')) as JWEHeader, encryptedKey, iv, ciphertext, authenticationTag }
}
