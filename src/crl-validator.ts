import { ErrorCode } from "./error";
import { JwsValidationOptions } from "./jws-compact";
import got from 'got';
import Log from "./logger";
import { parseJson, isNumeric } from "./utils";

interface CRL {
    kid: string,
    method: string,
    ctr: number,
    rids: string[]
}

export function isRidValid(ridWithTimestamp: string, log?: Log): boolean {
    // check the revocation identifier
    let result = true;
    const split = ridWithTimestamp.split('.');
    if (split.length > 2) {
        log?.error(`Revocation ID rid can have at most one ".": ${ridWithTimestamp}`, ErrorCode.REVOCATION_ERROR)
    }
    const rid = split[0];
    let base64urlRegExp = new RegExp('^[A-Za-z0-9_\-]+$');
    if (!base64urlRegExp.test(rid)) {
        result = false;
        log?.error(`Revocation ID rid SHALL use base64url alphabet: ${rid}`, ErrorCode.REVOCATION_ERROR)
    }
    if (rid.length > 24) {
        result = false;
        log?.error(`Revocation ID rid SHALL be no longer than 24 characters: ${rid}`, ErrorCode.REVOCATION_ERROR);
    }
    if (split.length == 2) {
        if (isNumeric(split[1])) {
            const timestamp = parseFloat(split[1]);
            const timestampDate = new Date();
            timestampDate.setTime(timestamp * 1000); // convert seconds to milliseconds
            const now = new Date();
            if (timestampDate > now) {
                log?.warn(`Revocation ID's timestamp is in the future: ${timestampDate}`, ErrorCode.NOT_YET_VALID);
            }
        } else {
            result = false;
            log?.error(`Revocation ID's timestamp is not a number: ${split[1]}`, ErrorCode.REVOCATION_ERROR);
        }
    }
    return result;
}

export async function downloadAndValidateCRL(issuerURL: string, kid: string, crlVersion: number, log: Log) {
    const crlUrl = `${issuerURL}/.well-known/crl/${kid}.json`;
    try {
        log.info("Retrieving CRL key from " + crlUrl);
        const response = await got(crlUrl, { timeout: JwsValidationOptions.jwksDownloadTimeOut });
        const crl = parseJson<CRL>(response.body);
        if (!crl) {
            log.error("Can't parse downloaded CRL", ErrorCode.REVOCATION_ERROR)
        } else {
            if (crl.kid !== kid) {
                log.error(`CRL kid doesn't match the key kid: crl kid = ${crl.kid}, key kid = ${kid}`, ErrorCode.REVOCATION_ERROR);
            }
            if (crl.method !== "rid") {
                log.error("Unknown CRL method: " + crl.method, ErrorCode.REVOCATION_ERROR);
            }
            if (crl.ctr !== crlVersion) {
                log.error(`CRL's ctr doesn't match the key crlVersion: ctr = ${crl.ctr}, crlVersion = ${crlVersion}`, ErrorCode.REVOCATION_ERROR);
            }
            if (!crl.rids || crl.rids.length == 0) {
                log.warn(`CRL's rids array is empty`, ErrorCode.REVOCATION_ERROR);
            } else {
                const badRids = crl.rids.filter(rid => {return !isRidValid(rid)});
                if (badRids.length > 0) {
                    log.error("CRL's rids contain invalid entries (longer than 24 char, not base64url alphabet, or invalid timestamp): " + badRids, ErrorCode.REVOCATION_ERROR);
                }
            }
        }
    } catch (err) {
        log.error(`Error retrieving the CRL at ${crlUrl}: ` + (err as Error).toString(), ErrorCode.REVOCATION_ERROR);
    }

}