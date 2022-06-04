// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { ErrorCode } from '../src/error';
import { LogLevels } from '../src/logger';
import { verifyAndImportHealthCardIssuerKey } from '../src/shcKeyValidator';
import * as utils from '../src/utils';
const testdataDir = './testdata/';

const EXPECTED_SUBJECT_ALT_NAME = 'https://smarthealth.cards/examples/issuer';

// Check if openssl is available. If not, this will add a warning in tests where an issuer key
// set contains a key with a x5c value.
const OPENSSL_AVAILABLE = utils.isOpensslAvailable();

async function testKey(fileName: string, subjectAltName = ''): Promise<ErrorCode[]> {
    const filePath = path.join(testdataDir, fileName);
    // fix cert validation to avoid cert expiration errors for pregenerated certs
    const validationTime = "1653955200"; // May 31, 2022 12:00:00 AM
    const result = (await verifyAndImportHealthCardIssuerKey(utils.loadJSONFromFile(filePath), validationTime, undefined ,subjectAltName));
    return result.flatten(LogLevels.WARNING).map(item => item.code);
}

test("Keys: valid", async () => {
    expect(await testKey('valid_key.json')).toHaveLength(0);
});

test("Keys: valid keys", async () => {
    expect(await testKey('valid_keys.json')).toHaveLength(0);
});

test("Keys: valid with x5c (3-cert chain)", async () => {
    expect(await testKey('valid_key_with_x5c.json', EXPECTED_SUBJECT_ALT_NAME)).toHaveLength(OPENSSL_AVAILABLE ? 0 : 1);
});

test("Keys: valid with x5c (2-cert chain)", async () => {
    expect(await testKey('valid_2_chain.public.json', EXPECTED_SUBJECT_ALT_NAME)).toHaveLength(OPENSSL_AVAILABLE ? 0 : 1);
});

test("Keys: wrong key identifier (kid)", async () => {
    expect(await testKey('wrong_kid_key.json')).toContain(ErrorCode.INVALID_KEY_WRONG_KID);
});

test("Keys: wrong elliptic curve", async () => {
    expect(await testKey('wrong_curve_key.json')).toContain(ErrorCode.INVALID_KEY_WRONG_CRV);
});

test("Keys: wrong key use (use)", async () => {
    expect(await testKey('wrong_use_key.json')).toContain(ErrorCode.INVALID_KEY_WRONG_USE);
});

test("Keys: wrong algorithm (alg)", async () => {
    expect(await testKey('wrong_alg_key.json')).toContain(ErrorCode.INVALID_KEY_WRONG_ALG);
});

test("Keys: wrong key type (kty)", async () => {
    expect(await testKey('wrong_kty_key.json')).toContain(ErrorCode.INVALID_KEY_WRONG_KTY);
});

test("Keys: private key", async () => {
    expect(await testKey('private_key.json')).toContain(ErrorCode.INVALID_KEY_PRIVATE);
});

test("Keys: wrong SAN in x5c cert", async () => {
    expect(await testKey('valid_key_with_x5c.json', 'https://invalid.url')).toContain(OPENSSL_AVAILABLE ? ErrorCode.INVALID_KEY_X5C : ErrorCode.OPENSSL_NOT_AVAILABLE);
});

test("Keys: wrong SAN in x5c cert (DNS prefix)", async () => {
    expect(await testKey('invalid_DNS_SAN.public.json', EXPECTED_SUBJECT_ALT_NAME)).toContain(OPENSSL_AVAILABLE ? ErrorCode.INVALID_KEY_X5C : ErrorCode.OPENSSL_NOT_AVAILABLE);
});

test("Keys: no SAN in x5c cert", async () => {
    expect(await testKey('invalid_no_SAN.public.json', EXPECTED_SUBJECT_ALT_NAME)).toContain(OPENSSL_AVAILABLE ? ErrorCode.INVALID_KEY_X5C : ErrorCode.OPENSSL_NOT_AVAILABLE);
});

test("Keys: key and x5c cert mismatch", async () => {
    expect(await testKey('cert_mismatch.public.json')).toContain(OPENSSL_AVAILABLE ? ErrorCode.INVALID_KEY_X5C : ErrorCode.OPENSSL_NOT_AVAILABLE);
});

test("Keys: invalid x5c cert chain", async () => {
    expect(await testKey('invalid_chain.public.json')).toContain(OPENSSL_AVAILABLE ? ErrorCode.INVALID_KEY_X5C : ErrorCode.OPENSSL_NOT_AVAILABLE);
});
