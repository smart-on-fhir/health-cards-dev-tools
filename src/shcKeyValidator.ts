// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import jose, { JWK } from 'node-jose';
import { ErrorCode } from './error';
import { ValidationResult } from './validate';
import { validateSchema } from './schema';
import keySetSchema from '../schema/keyset-schema.json';
import { KeySet, store } from './keys';


export async function verifyHealthCardIssuerKey(keySet: KeySet, log = new Log('Validate Key-Set')): Promise<ValidationResult> {


    // check that keySet is valid
    if (!(keySet instanceof Object) || !keySet.keys || !(keySet.keys instanceof Array)) {
        log.fatal("keySet not valid. Expect {keys : JWK.Key[]}", ErrorCode.INVALID_KEY_SCHEMA);
        return new ValidationResult(undefined, log);
    }

    // failures will be recorded in the log. we can continue processing.
    validateSchema(keySetSchema, keySet, log);

    for (let i = 0; i < keySet.keys.length; i++) {

        let key: JWK.Key = keySet.keys[i];

        const keyName = 'key[' + (key.kid || i.toString()) + ']';

        log.info('Validating key : ' + keyName);
        log.debug("Key " + i.toString() + ":");
        log.debug(JSON.stringify(key, null, 3));

        // check for private key material (as to happen before the following store.add, because the returned
        // value will be the corresponding public key)
        // TODO: this is RSA/ECDSA specific, find a different API to detect private keys more broadly
        if ((key as (JWK.Key & { d: string })).d) {
            log.error(keyName + ': ' + "key contains private key material.", ErrorCode.INVALID_KEY_PRIVATE);
        }

        try {
            key = await store.add(key);
        } catch (error) {
            log.error('Error adding key to keyStore : ' + (error as Error).message, ErrorCode.INVALID_KEY_UNKNOWN);
            return new ValidationResult(undefined, log);
        }

        // check that kid is properly generated
        if (!key.kid) {
            log.error(keyName + ': ' + "'kid' missing in issuer key", ErrorCode.INVALID_KEY_MISSING_KID);
        } else {

            await key.thumbprint('SHA-256')
                .then(tpDigest => {
                    const thumbprint = jose.util.base64url.encode(tpDigest);
                    if (key.kid !== thumbprint) {
                        log.error(keyName + ': ' + "'kid' does not match thumbprint in issuer key. expected: "
                            + thumbprint + ", actual: " + key.kid, ErrorCode.INVALID_KEY_WRONG_KID);
                    }
                })
                .catch(err => {
                    log.error(keyName + ': ' + "Failed to calculate issuer key thumbprint : " + (err as Error).message, ErrorCode.INVALID_KEY_UNKNOWN);
                });
        }

        // check that key type is 'EC'
        if (!key.kty) {
            log.error(keyName + ': ' + "'kty' missing in issuer key", ErrorCode.INVALID_KEY_MISSING_KTY);
        } else if (key.kty !== 'EC') {
            log.error(keyName + ': ' + "wrong key type in issuer key. expected: 'EC', actual: " + key.kty, ErrorCode.INVALID_KEY_WRONG_KTY);
        }

        // check that EC curve is 'ES256'
        if (!key.alg) {
            log.error(keyName + ': ' + "'alg' missing in issuer key", ErrorCode.INVALID_KEY_MISSING_ALG);
        } else if (key.alg !== 'ES256') {
            log.warn(keyName + ': ' + "wrong algorithm in issuer key. expected: 'ES256', actual: " + key.alg, ErrorCode.INVALID_KEY_WRONG_ALG);
        }

        // check that usage is 'sig'
        if (!key.use) {
            log.error(keyName + ': ' + "'use' missing in issuer key", ErrorCode.INVALID_KEY_MISSING_USE);
        } else if (key.use !== 'sig') {
            log.warn(keyName + ': ' + "wrong usage in issuer key. expected: 'sig', actual: " + key.use, ErrorCode.INVALID_KEY_WRONG_USE);
        }
    }

    return new ValidationResult(keySet, log);
}
