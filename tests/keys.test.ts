// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.


import path from 'path';
import { ErrorCode } from '../src/error';
import { LogLevels } from '../src/logger';
import { verifyHealthCardIssuerKey } from '../src/shcKeyValidator';
import * as utils from '../src/utils';
const testdataDir = './testdata/';

async function testKey(fileName: string): Promise<ErrorCode[]> {
    const filePath = path.join(testdataDir, fileName);
    const result = (await verifyHealthCardIssuerKey(utils.loadJSONFromFile(filePath)));
    return result.log.flatten(LogLevels.WARNING).map(item => item.code);
}
/*
test("Keys: valid", async () => {
    expect(await testKey('valid_key.json')).toHaveLength(0);
});

test("Keys: valid keys", async () => {
    expect(await testKey('valid_keys.json')).toHaveLength(0);
});

test("Keys: wrong key identifier (kid)", async () => {
    expect(await testKey('wrong_kid_key.json')).toContain(ErrorCode.INVALID_WRONG_KID);
});

test("Keys: wrong elliptic curve", async () => {
    expect(await testKey('wrong_curve_key.json')).toContain(ErrorCode.INVALID_WRONG_ALG);
});

test("Keys: wrong key use (use)", async () => {
    expect(await testKey('wrong_use_key.json')).toContain(ErrorCode.INVALID_WRONG_USE);
});

test("Keys: wrong algorithm (alg)", async () => {
    expect(await testKey('wrong_alg_key.json')).toContain(ErrorCode.INVALID_WRONG_ALG);
});

test("Keys: wrong key type (kty)", async () => {
    expect(await testKey('wrong_kty_key.json')).toContain(ErrorCode.INVALID_WRONG_KTY);
});
*/
test("Keys: private key", async () => {
    expect(await testKey('private_key.json')).toContain(ErrorCode.INVALID_WRONG_KID);
});
