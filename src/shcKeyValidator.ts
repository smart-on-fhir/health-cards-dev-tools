// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import jose, { JWK } from 'node-jose';
import { ErrorCode } from './error';


export class shcKeyValidator {

    async verifyHealthCardIssuerKey(jwk: string | Buffer): Promise<Log> {

        const log: Log = new Log('IssuerKey');
        const keyStore = JWK.createKeyStore();

        return keyStore.add(jwk)

            .then(async key => {
                // check that key type is 'EC'
                if (!key.kty) {
                    log.error("'kty' missing in issuer key", ErrorCode.INVALID_MISSING_KTY);
                } else if (key.kty !== 'EC') {
                    log.error("wrong key type in issuer key. expected: 'EC', actual: " + key.kty, ErrorCode.INVALID_WRONG_KTY);
                }

                // check that EC curve is 'ES256'
                if (!key.alg) {
                    log.error("'alg' missing in issuer key", ErrorCode.INVALID_MISSING_ALG);
                } else if (key.alg !== 'ES256') {
                    log.error("wrong algorithm in issuer key. expected: 'ES256', actual: " + key.alg, ErrorCode.INVALID_WRONG_ALG);
                }

                // check that usage is 'sig'
                if (!key.use) {
                    log.error("'use' missing in issuer key", ErrorCode.INVALID_MISSING_USE);
                } else if (key.use !== 'sig') {
                    log.error("wrong usage in issuer key. expected: 'sig', actual: " + key.use, ErrorCode.INVALID_WRONG_USE);
                }

                // check that kid is properly generated
                if (!key.kid) {
                    log.error("'kid' missing in issuer key", ErrorCode.INVALID_MISSING_KID);
                } else {
                    await key.thumbprint('SHA-256')
                        .then(tpDigest => {
                            const thumbprint = jose.util.base64url.encode(tpDigest);
                            if (key.kid !== thumbprint) {
                                log.error("'kid' does not match thumbprint in issuer key. expected: "
                                    + thumbprint + ", actual: " + key.kid, ErrorCode.INVALID_WRONG_KID);
                            }
                        })
                        .catch(err => {
                            log.error("Failed to calculate issuer key thumbprint : " + (err as Error).message, ErrorCode.INVALID_UNKNOWN);
                        });
                }

                return log;
            })
            .catch(err => {
                log.error("Failed to parse issuer key : " + (err as Error).message, ErrorCode.INVALID_SCHEMA);
                return log;
            });

    }
}
