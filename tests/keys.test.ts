// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import {shcKeyValidator, KeyValidationErrors} from '../src/shcKeyValidator';
const testdataDir = './testdata/';

async function testKey(fileName: string): Promise<KeyValidationErrors[]> {
    const filePath = path.join(testdataDir, fileName);
    const keyValidator = new shcKeyValidator();
    return await keyValidator.verifyHealthCardIssuerKey(fs.readFileSync(filePath));
}

test("Keys: valid", async () => {
    expect(await testKey('valid_key.json')).toHaveLength(0);});

test("Keys: wrong key identifier (kid)", async () => {
    expect(await testKey('wrong_kid_key.json')).toContain(KeyValidationErrors.INVALID_WRONG_KID);});

test("Keys: wrong elliptic curve", async () => {
    expect(await testKey('wrong_curve_key.json')).toContain(KeyValidationErrors.INVALID_WRONG_ALG);});

test("Keys: wrong key use (use)", async () => { 
    expect(await testKey('wrong_use_key.json')).toContain(KeyValidationErrors.INVALID_WRONG_USE);});

test("Keys: wrong algorithm (alg)", async () => {
    expect(await testKey('wrong_alg_key.json')).toContain(KeyValidationErrors.INVALID_WRONG_ALG);});

test("Keys: wrong key type (kty)", async () => {
    expect(await testKey('wrong_kty_key.json')).toContain(KeyValidationErrors.INVALID_WRONG_KTY);});
