// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { validateSchema } from './schema';
import { ErrorCode } from './error';
import jwsCompactSchema from '../schema/jws-schema.json';
import * as jwsPayload from './jws-payload';
import * as keys from './keys';
import pako from 'pako';
import got from 'got/dist/source';
import jose, { JWK } from 'node-jose';
import path from 'path';
import Log from './logger';
import { ValidationResult } from './validate';


const MAX_JWS_LENGTH = 1195;


export const schema = jwsCompactSchema;


export async function validate(jws: JWS): Promise<ValidationResult> {

    // the jws string is not JSON.  It is base64url.base64url.base64url

    const log = new Log('JWS-compact');


    if (!/[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+/g.test(jws.trim())) {
        return new ValidationResult(
            undefined,
            log.fatal('Failed to parse JWS-compact data as \'base64url.base64url.base64url\' string.', ErrorCode.JSON_PARSE_ERROR)
        );
    }


    if (jws.length > MAX_JWS_LENGTH) {
        log.error('JWS, at ' + jws.length.toString() + ' characters, exceeds max character length of ' + MAX_JWS_LENGTH.toString(), ErrorCode.JWS_TOO_LONG);
    }


    // failures will be recorded in the log. we can continue processing.
    validateSchema(jwsCompactSchema, jws, log);


    // split into header[0], payload[1], key[2]
    const parts = jws.split('.');
    const rawPayload = parts[1];


    let inflatedPayload;
    try {
        inflatedPayload = pako.inflateRaw(Buffer.from(rawPayload, 'base64'), { to: 'string' });
        log.info('JWS payload inflated');
    } catch (err) {
        // TODO: we should try non-raw inflate, or try to parse JSON directly (if they forgot to deflate) and continue, to report the exact error
        log.error(
            ["Error inflating JWS payload. Did you use raw DEFLATE compression?",
                (err as string)].join('\n'),
            ErrorCode.INFLATION_ERROR);
    }


    // try to validate the payload (even if infation failed)
    const payloadResult = jwsPayload.validate(inflatedPayload || rawPayload);
    const payload = payloadResult.result as JWSPayload;
    log.child = payloadResult.log;


    // if we did not get a payload back, it failed to be parsed and we cannot extract the key url
    // so we can stop.
    // the jws-payload child will contain the parse errors.
    // The payload validation may have a Fatal error if 
    if (payload == null) {
        return { result: payload, log: log };
    }


    // Extract the key url
    if (!payload.iss) {
        // continue, since we might have the key we need in the global keystore
        log.error("Can't find 'iss' entry in JWS payload", ErrorCode.SCHEMA_ERROR);
    }


    // download the keys into the keystore. if it fails, continue an try to use whatever is in the keystore.
    await downloadKey(path.join(payload.iss, '/.well-known/jwks.json'), log);


    if (await verifyJws(jws, log)) {
        log.info("JWS signature verified");
    }


    // TODO: the result should probably be the expanded (non-compact) JWS object.

    return { result: jws, log: log };
}


async function downloadKey(keyPath: string, log: Log): Promise<JWK.Key[] | undefined> {

    log.info("Retrieving issuer key from " + keyPath);

    return await got(keyPath).json<{ keys: unknown[] }>()
        // TODO: split up download/parsing to provide finer-grainded error message
        .then(async keysObj => {
            log.debug("Downloaded issuer key : " + JSON.stringify(keysObj));
            return [
                await keys.store.add(JSON.stringify(keysObj.keys[0]), 'json'),
                await keys.store.add(JSON.stringify(keysObj.keys[1]), 'json')
            ];
        })
        .catch(() => {
            log.error("Can't parse downloaded issuer keys as a key set",
                ErrorCode.ISSUER_KEY_DOWNLOAD_ERROR);
            return undefined;
        });

}


async function verifyJws(jws: string, log: Log): Promise<boolean> {

    const verifier: jose.JWS.Verifier = jose.JWS.createVerify(keys.store);

    try {
        await verifier.verify(jws, { allowEmbeddedKey: true });
        return true;

    } catch (error) {
        log.error('JWS verification failed : (' + (error as Error).message + ')',
            ErrorCode.JWS_VERIFICATION_ERROR);
        return false;
    }

}
