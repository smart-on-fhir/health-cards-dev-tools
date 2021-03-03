// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { validateCard, ValidationType } from '../src/validate';
import { getFileData } from '../src/file';
import { ErrorCode } from '../src/error';
import { LogLevels } from '../src/logger';

const testdataDir = './testdata/';

async function testCard(fileName: string, fileType: ValidationType = 'healthcard', levels : LogLevels[] = [LogLevels.ERROR, LogLevels.FATAL]): Promise<{ title: string, message: string, code: ErrorCode }[]> {
    const filePath = path.join(testdataDir, fileName);
    const outputTree = await validateCard(await getFileData(filePath), fileType);
    return outputTree.flatten().filter(i=>{return levels.includes(i.level);});
}

// Test valid examples from spec
test("Cards: valid 00 FHIR bundle", async () => expect(await testCard('example-00-a-fhirBundle.json', "fhirbundle")).toHaveLength(0));
test("Cards: valid 01 FHIR bundle", async () => expect(await testCard('example-01-a-fhirBundle.json', "fhirbundle")).toHaveLength(0));

test("Cards: valid 00 JWS payload expanded", async () => expect(await testCard('example-00-b-jws-payload-expanded.json', "jwspayload")).toHaveLength(0));
test("Cards: valid 01 JWS payload expanded", async () => expect(await testCard('example-01-b-jws-payload-expanded.json', "jwspayload")).toHaveLength(0));

test("Cards: valid 00 JWS payload minified", async () => expect(await testCard('example-00-c-jws-payload-minified.json', "jwspayload")).toHaveLength(0));
test("Cards: valid 01 JWS payload minified", async () => expect(await testCard('example-01-c-jws-payload-minified.json', "jwspayload")).toHaveLength(0));

test("Cards: valid 00 JWS", async () => expect(await testCard('example-00-d-jws.txt', "jws")).toHaveLength(0));
test("Cards: valid 01 JWS", async () => expect(await testCard('example-01-d-jws.txt', "jws")).toHaveLength(0));

test("Cards: valid 00 health card", async () => expect(await testCard('example-00-e-file.smart-health-card', "healthcard")).toHaveLength(0));
test("Cards: valid 01 health card", async () => expect(await testCard('example-01-e-file.smart-health-card', "healthcard")).toHaveLength(0));

test("Cards: valid 00 QR numeric", async () => expect(await testCard('example-00-f-qr-code-numeric.txt', "qrnumeric")).toHaveLength(0));
test("Cards: valid 01 QR numeric", async () => expect(await testCard('example-01-f-qr-code-numeric.txt', "qrnumeric")).toHaveLength(0));

test("Cards: valid 00 QR code", async () => expect(await testCard('example-00-g-qr-code-0.svg', "qr")).toHaveLength(0));
test("Cards: valid 01 QR code", async () => expect(await testCard('example-01-g-qr-code-0.svg', "qr")).toHaveLength(0));

test("Cards: invalid deflate", async () => {
    const results = await testCard('test-example-00-e-file-invalid_deflate.smart-health-card');
    expect(results).toHaveLength(2);
    expect(results[0].code).toBe(ErrorCode.INFLATION_ERROR);
    expect(results[1].code).toBe(ErrorCode.JSON_PARSE_ERROR);
});

test("Cards: no deflate", async () => {
    const results = await testCard('test-example-00-e-file-no_deflate.smart-health-card');
    expect(results).toHaveLength(3);
    expect(results[0].code).toBe(ErrorCode.JWS_TOO_LONG);
    expect(results[1].code).toBe(ErrorCode.INFLATION_ERROR);
    expect(results[2].code).toBe(ErrorCode.JSON_PARSE_ERROR);
});

test("Cards: invalid issuer url", async () => {
    const results = await testCard('test-example-00-e-file-invalid_issuer_url.smart-health-card');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.ISSUER_KEY_DOWNLOAD_ERROR);
});

test("Cards: invalid QR mode", async () => {
    const results = await testCard('test-example-00-f-qr-code-numeric-wrong_qr_mode.txt', 'qr');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_SHC_STRING);
});

test("Cards: invalid QR header", async () => {
    const results = await testCard('test-example-00-f-qr-code-numeric-wrong_qr_header.txt', 'qr');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.ERROR); // TODO: Create error code for this case
});

test("Cards:JWS too long", async () => {
    const results = await testCard('test-example-00-d-jws-jws_too_long.txt', 'jws');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.JWS_TOO_LONG);
});

test("Cards: wrong file extension", async () => {
    const results = await testCard('test-example-00-e-file.wrong-extension', 'healthcard', [LogLevels.WARNING, LogLevels.ERROR, LogLevels.FATAL]);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_FILE_EXTENSION);
});

test("Cards: invalid signature", async () => {
    const results = await testCard('test-example-00-d-jws-invalid-signature.txt', 'jws');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.JWS_VERIFICATION_ERROR);
});
