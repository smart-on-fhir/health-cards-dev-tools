// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import jose, { JWK } from 'node-jose';
import { ErrorCode } from './error';
import { ValidationResult } from './validate';
import { validateSchema } from './schema';
import keySetSchema from '../schema/keyset-schema.json';
import { KeySet, store } from './keys';
import execa from 'execa';
import fs from 'fs';
import path from 'path';
import {v4 as uuidv4} from 'uuid';


// directory where to write cert files for openssl validation
const tmpDir = 'tmp';
// PEM and ASN.1 DER constants
const PEM_CERT_HEADER = '-----BEGIN CERTIFICATE-----\n';
const PEM_CERT_FOOTER = '\n-----END CERTIFICATE-----';
const PEM_CERT_FILE_EXT = '.pem';
const EC_P256_ASN1_PUBLIC_KEY_HEADER_HEX = "3059301306072a8648ce3d020106082a8648ce3d030107034200";
const EC_COMPRESSED_KEY_HEX = "04";

// PEM format for P-256 (prime256v1) public key (as used by issuer keys in SMART Health Cards)
// -----BEGIN PUBLIC KEY-----
// <-- multi-line base64 encoding of ASN.1:
//   [0..25]: header for P-256 curve (26 bytes)
//   [26]: 0x04 (uncompressed public key)
//   [27..58]: x (32 bytes)
//   [59..90]: y (32 bytes)
// -->
// -----END PUBLIC KEY-----

// PEM to DER encoding
// Drop the first and last lines (BEGIN/END markers), concatenate the others, base64-decode
const PEMtoDER = (pem: string[]) => Buffer.from(pem.slice(1,-2).join(), "base64");

interface CertFields {
    x: string;
    y: string;
    notBefore: string;
    notAfter: string;
    subjectAltName: string;
}

interface EcPublicJWK extends JWK.Key {
    x: string,
    y: string,
    x5c?: string[]
}

// validate a JWK certificate chain (x5c value)
function validateX5c(x5c: string[], log: Log): CertFields | undefined {
    // we use OpenSSL to validate the certificate chain, first check if present
    try {
        execa.commandSync("openssl version");
    } catch (err) {
        log.warn('OpenSSL not available to validate the X.509 certificate chain; skipping validation', ErrorCode.ERROR);
        return;
    }
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }
    // extract each cert in the x5c array, save to PEM-encoded temp file (already base64, so just need to wrap with file header/footer)
    const tmpFileName = uuidv4();
    let rootCaArg = '';
    let caArg = '';
    let issuerCert = '';
    const certFiles = x5c.map((cert, index, certs) => {
        const certFileName = path.join(tmpDir, tmpFileName + '-' + index + PEM_CERT_FILE_EXT);
        if (index === 0) {
            // first cert in the x5c array is the leaf, issuer cert
            issuerCert = ' ' + certFileName;
        } else if (index + 1 === certs.length) {
            // last cert in the x5c array is the root CA cert
            rootCaArg = '-CAfile ' + certFileName;
        } else {
            // all other certs in the x5c array are intermediate certs
            caArg += ' -untrusted ' + certFileName;
        }
        fs.writeFileSync(certFileName, PEM_CERT_HEADER + cert + PEM_CERT_FOOTER);
        return certFileName;
    })
    let x509OutFile = '';
    try {
        //
        // validate the chain with OpenSSL
        //
        const opensslVerifyCommand = "openssl verify " + rootCaArg + caArg + issuerCert;
        log.debug('Calling openssl for x5c validation: ' + opensslVerifyCommand);
        let result = execa.commandSync(opensslVerifyCommand);
        if (result.exitCode != 0) {
            log.debug(result.stderr);
            throw 'OpenSSL returned an error: exit code ' + result.exitCode;
        }

        //
        // extract issuer cert fields with OpenSSL
        //
        x509OutFile = path.join(tmpDir,tmpFileName + '.txt');
        const opensslX509Command = 'openssl x509 -in ' + issuerCert + ' -noout -ext subjectAltName -startdate -enddate -pubkey -out ' + x509OutFile;
        // output will be, for example: 
        //   X509v3 Subject Alternative Name:
        //       URI:<issuer URL>
        //   notBefore=Mar 29 15:42:17 2021 GMT
        //   notAfter=Mar 28 15:42:17 2026 GMT
        //   -----BEGIN PUBLIC KEY-----
        //   <multi-line base64 encoded key>
        //   -----END PUBLIC KEY-----
        log.debug('Calling openssl for parsing issuer cert: ' + opensslX509Command);
        result = execa.commandSync(opensslX509Command);
        if (result.exitCode != 0) {
            log.debug(result.stderr);
            throw 'OpenSSL returned an error: exit code ' + result.exitCode;
        }
        
        //
        // Validate the issuer cert fields
        //
        const x509OutLines = fs.readFileSync(x509OutFile, 'utf-8').split(/\r?\n/);
        if (!x509OutLines || x509OutLines.length < 8) {
            throw 'Too few lines output by OpenSSL x509 command';
        }
        const subjectAltName = x509OutLines[1].trim(); // skip header line 0
        // 'prefix=Mon DD HH:MM:SS YYYY GMT' => 'Mon DD YYYY'
        const parseOpenSSLDate = (date: string, prefix: string): string =>
            date.substring(prefix.length, prefix.length + 7).concat(date.substring(date.length - 8, date.length - 4));
        const notBefore = parseOpenSSLDate(x509OutLines[2].trim(), 'notBefore=');
        const notAfter = parseOpenSSLDate(x509OutLines[3].trim(), 'notAfter=');
        const derPublicKey = PEMtoDER(x509OutLines.slice(4));
        if (derPublicKey.slice(0,26).toString('hex') !== EC_P256_ASN1_PUBLIC_KEY_HEADER_HEX) throw "Invalid EC P-256 ASN.1 public key header";
        if (derPublicKey.slice(26,27).toString('hex') !== EC_COMPRESSED_KEY_HEX) throw "Invalid EC public key encoding";
        return {
            x: jose.util.base64url.encode(derPublicKey.slice(27,59)),
            y: jose.util.base64url.encode(derPublicKey.slice(59,91)),
            notBefore: notBefore,
            notAfter: notAfter,
            subjectAltName: subjectAltName
        }
    } catch (err) {
        log.error('Error validating x5c certificates: ' + err, ErrorCode.INVALID_KEY_X5C);
    } finally {
        certFiles.map((file) => {
            fs.unlinkSync(file);
        })
        if (x509OutFile) fs.unlinkSync(x509OutFile);
    }
}

export async function verifyHealthCardIssuerKey(keySet: KeySet, log = new Log('Validate Key-Set'), expectedSubjectAltName = ''): Promise<ValidationResult> {

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
        //       (although the spec mandates ECDSA, for now...)
        if ((key as (JWK.Key & { d: string })).d) {
            log.error(keyName + ': ' + "key contains private key material.", ErrorCode.INVALID_KEY_PRIVATE);
        }

        // check cert chain if present, if so, validate it
        const ecPubKey = key as EcPublicJWK;
        if (ecPubKey.x5c) {
            const certFields = validateX5c(ecPubKey.x5c, log);
            if (certFields) {
                const checkKeyValue = (v: 'x' | 'y') => {
                    if (ecPubKey[v]) {
                        if (certFields[v] !== ecPubKey[v]) {
                            log.error(`JWK public key value ${v} doesn't match the certificate's public key`, ErrorCode.INVALID_KEY_X5C);
                        }
                    } else {
                        log.error(`JWK missing elliptic curve public key value ${v}`, ErrorCode.INVALID_KEY_SCHEMA);
                    }
                }
                checkKeyValue('x');
                checkKeyValue('y');
                if (expectedSubjectAltName && certFields.subjectAltName !== expectedSubjectAltName) {
                    log.error(`Subject Alternative Name extension in the issuer's cert (in x5c JWK value) doesn't match issuer URL. 
                    Expected: ${expectedSubjectAltName}. Actual: ${certFields.subjectAltName}`, ErrorCode.INVALID_KEY_X5C);
                }
                const now = new Date();
                if (now < new Date(certFields.notBefore)) {
                    log.warn('issuer certificate (in x5c JWK value) is not yet valid', ErrorCode.INVALID_KEY_X5C);
                }
                if (now > new Date(certFields.notAfter)) {
                    log.warn('issuer certificate (in x5c JWK value) is expired', ErrorCode.INVALID_KEY_X5C);
                }
            }
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
