// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-explicit-any */

/* Validate SMART Health Card JSON Web Keys (JWK) */

import log, {LogLevels} from './logger';
import jose, { JWK } from 'node-jose';

export enum KeyValidationErrors {
    INVALID_MISSING_KTY,
    INVALID_WRONG_KTY,
    INVALID_MISSING_ALG,    
    INVALID_WRONG_ALG,
    INVALID_MISSING_USE,
    INVALID_WRONG_USE,
    INVALID_MISSING_KID,
    INVALID_WRONG_KID,
    INVALID_SCHEMA,
    INVALID_UNKNOWN
}

export class shcKeyValidator {

    async verifyHealthCardIssuerKey(jwk: string | Buffer): Promise<KeyValidationErrors[]> {
        const validationResult : KeyValidationErrors[] = []; 
        const keyStore = JWK.createKeyStore();

        return keyStore.add(jwk)

            .then(async key => {
                // check that key type is 'EC'
                if (!key.kty) {
                    log("'kty' missing in issuer key", LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_MISSING_KTY);
                } else if (key.kty !== 'EC') {
                    log("wrong key type in issuer key. expected: 'EC', actual: " + key.kty, LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_WRONG_KTY);
                }

                // check that EC curve is 'ES256'
                if (!key.alg) {
                    log("'alg' missing in issuer key", LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_MISSING_ALG);
                } else if (key.alg !== 'ES256') {
                    log("wrong algorithm in issuer key. expected: 'ES256', actual: " + key.alg, LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_WRONG_ALG);
                }

                // check that usage is 'sig'
                if (!key.use) {
                    log("'use' missing in issuer key", LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_MISSING_USE);
                } else if (key.use !== 'sig') {
                    log("wrong usage in issuer key. expected: 'sig', actual: " + key.use, LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_WRONG_USE);
                }

                // check that kid is properly generated
                if (!key.kid) {
                    log("'kid' missing in issuer key", LogLevels.ERROR);
                    validationResult.push(KeyValidationErrors.INVALID_MISSING_KID);
                } else {
                    await key.thumbprint('SHA-256')
                        .then(tpDigest => {
                            const thumbprint = jose.util.base64url.encode(tpDigest);
                            if (key.kid !== thumbprint) {
                                log("'kid' does not match thumbprint in issuer key. expected: " 
                            + thumbprint + ", actual: " + key.kid, LogLevels.ERROR);
                                validationResult.push(KeyValidationErrors.INVALID_WRONG_KID);
                            }
                        })
                        .catch(err => {
                            log("Failed to calculate issuer key thumbprint", LogLevels.ERROR, err);
                            validationResult.push(KeyValidationErrors.INVALID_UNKNOWN);
                        });
                }

                return validationResult;
            })
            .catch(err => {
                log("Failed to parse issuer key", LogLevels.ERROR, err);
                validationResult.push(KeyValidationErrors.INVALID_SCHEMA);
                return validationResult;
            });

    }
}