// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { validateCard, ValidationType } from '../src/validate';
import { getFileData } from '../src/file';
import { ErrorCode } from '../src/error';
import { LogLevels } from '../src/logger';


const testdataDir = './testdata/';

type flatLogItems = { title: string, message: string, code: ErrorCode, level: LogLevels };

async function testCard(fileName: string | string[], fileType: ValidationType = 'healthcard', levels: LogLevels[] = [LogLevels.WARNING, LogLevels.ERROR, LogLevels.FATAL]): Promise<flatLogItems[]> {
    if (typeof fileName === 'string') fileName = [fileName];
    const files = [];
    for (const fn of fileName) { // TODO: I tried a map here, but TS didn't like the async callback 
        files.push(await getFileData(path.join(testdataDir, fn)));
    }
    const log = (await validateCard(files, fileType)).log;
    return log.flatten().filter(i => { return levels.includes(i.level); })
        // filtering out key related warnings
        .filter(i => !(i.code >= ErrorCode.INVALID_KEY_MISSING_KTY && i.level === LogLevels.WARNING) );
}

// Test valid examples from spec
test("Cards: valid 00 FHIR bundle", async () => expect(await testCard(['example-00-a-fhirBundle.json'], "fhirbundle")).toHaveLength(0));
test("Cards: valid 01 FHIR bundle", async () => expect(await testCard(['example-01-a-fhirBundle.json'], "fhirbundle")).toHaveLength(0));
test("Cards: valid 02 FHIR bundle", async () => expect(await testCard(['example-02-a-fhirBundle.json'], "fhirbundle")).toHaveLength(0));

test("Cards: valid 00 JWS payload expanded", async () => expect(await testCard(['example-00-b-jws-payload-expanded.json'], "jwspayload")).toHaveLength(0));
test("Cards: valid 01 JWS payload expanded", async () => expect(await testCard(['example-01-b-jws-payload-expanded.json'], "jwspayload")).toHaveLength(0));
test("Cards: valid 02 JWS payload expanded", async () => expect(await testCard(['example-02-b-jws-payload-expanded.json'], "jwspayload")).toHaveLength(0));

test("Cards: valid 00 JWS payload minified", async () => expect(await testCard(['example-00-c-jws-payload-minified.json'], "jwspayload")).toHaveLength(0));
test("Cards: valid 01 JWS payload minified", async () => expect(await testCard(['example-01-c-jws-payload-minified.json'], "jwspayload")).toHaveLength(0));
test("Cards: valid 02 JWS payload minified", async () => expect(await testCard(['example-02-c-jws-payload-minified.json'], "jwspayload")).toHaveLength(0));

test("Cards: valid 00 JWS", async () => expect(await testCard(['example-00-d-jws.txt'], "jws")).toHaveLength(0));
test("Cards: valid 01 JWS", async () => expect(await testCard(['example-01-d-jws.txt'], "jws")).toHaveLength(0));
test("Cards: valid 02 JWS", async () => expect(await testCard(['example-02-d-jws.txt'], "jws")).toHaveLength(0));

test("Cards: valid 00 health card", async () => expect(await testCard(['example-00-e-file.smart-health-card'], "healthcard")).toHaveLength(0));
test("Cards: valid 01 health card", async () => expect(await testCard(['example-01-e-file.smart-health-card'], "healthcard")).toHaveLength(0));
test("Cards: valid 02 health card", async () => expect(await testCard(['example-02-e-file.smart-health-card'], "healthcard")).toHaveLength(0));

test("Cards: valid 00 QR numeric", async () => expect(await testCard(['example-00-f-qr-code-numeric-value-0.txt'], "qrnumeric")).toHaveLength(0));
test("Cards: valid 01 QR numeric", async () => expect(await testCard(['example-01-f-qr-code-numeric-value-0.txt'], "qrnumeric")).toHaveLength(0));
test("Cards: valid 02 QR numeric", async () => expect(
    await testCard(['example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric")).toHaveLength(0));
test("Cards: valid 02 QR numeric (out of order)", async () => expect(
    await testCard(['example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric")).toHaveLength(0));

test("Cards: valid 00 QR code", async () => expect(await testCard(['example-00-g-qr-code-0.svg'], "qr")).toHaveLength(0));
test("Cards: valid 01 QR code", async () => expect(await testCard(['example-01-g-qr-code-0.svg'], "qr")).toHaveLength(0));

test("Cards: valid 02 QR code", async () => expect(
    await testCard(['example-02-g-qr-code-0.svg', 'example-02-g-qr-code-1.svg', 'example-02-g-qr-code-2.svg'], "qr")).toHaveLength(0));

test("Cards: valid 02 QR code PNG", async () => expect(
    await testCard(['example-02-g-qr-code-0.png', 'example-02-g-qr-code-1.png', 'example-02-g-qr-code-2.png'], "qr")).toHaveLength(0));

test("Cards: valid 02 QR code JPG", async () => expect(
    await testCard(['example-02-g-qr-code-0.jpg', 'example-02-g-qr-code-1.jpg', 'example-02-g-qr-code-2.jpg'], "qr")).toHaveLength(0));

test("Cards: valid 02 QR code BMP", async () => expect(
    await testCard(['example-02-g-qr-code-0.bmp', 'example-02-g-qr-code-1.bmp', 'example-02-g-qr-code-2.bmp'], "qr")).toHaveLength(0));

test("Cards: invalid deflate", async () => {
    const results = await testCard(['test-example-00-e-file-invalid_deflate.smart-health-card']);
    expect(results).toHaveLength(2);
    expect(results[0].code).toBe(ErrorCode.INFLATION_ERROR);
    expect(results[1].code).toBe(ErrorCode.JSON_PARSE_ERROR);
});

test("Cards: no deflate", async () => {
    const results = await testCard(['test-example-00-e-file-no_deflate.smart-health-card']);
    expect(results).toHaveLength(2);
    expect(results[0].code).toBe(ErrorCode.INFLATION_ERROR);
    expect(results[1].code).toBe(ErrorCode.JSON_PARSE_ERROR);
});

test("Cards: invalid issuer url", async () => {
    const results = await testCard(['test-example-00-e-file-invalid_issuer_url.smart-health-card']);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.ISSUER_KEY_DOWNLOAD_ERROR);
});

// TODO: Test not working: fix it
// test("Cards: invalid QR mode", async () => {
//     const results = await testCard('test-example-00-f-qr-code-numeric-wrong_qr_mode.txt', 'qr');
//     expect(results).toHaveLength(1);
//     expect(results[0].code).toBe(ErrorCode.ERROR);  // TODO: Create error code for this case
// });

test("Cards: invalid QR header", async () => {
    const results = await testCard(['test-example-00-f-qr-code-numeric-wrong_qr_header.txt'], 'qrnumeric');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_NUMERIC_QR_HEADER);
});

// TODO: FIX this test
// test("Cards:JWS too long", async () => {
//     const results = await testCard(['test-example-00-d-jws-jws_too_long.txt'], 'jws');
//     expect(results).toHaveLength(1);
//     expect(results[0].code).toBe(ErrorCode.JWS_TOO_LONG);
// });

test("Cards: wrong file extension", async () => {
    const results = await testCard(['test-example-00-e-file.wrong-extension'], 'healthcard', [LogLevels.WARNING, LogLevels.ERROR, LogLevels.FATAL]);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_FILE_EXTENSION);
    expect(results[0].level).toBe(LogLevels.WARNING);
});

test("Cards: invalid signature", async () => {
    const results = await testCard(['test-example-00-d-jws-invalid-signature.txt'], 'jws');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.JWS_VERIFICATION_ERROR);
});

test("Cards: invalid single chunk QR header", async () => {
    const results = await testCard(['test-example-00-f-qr-code-numeric-value-0-wrong-multi-chunk.txt'], 'qrnumeric', [LogLevels.WARNING, LogLevels.ERROR, LogLevels.FATAL]);
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_NUMERIC_QR_HEADER);
    expect(results[0].level).toBe(LogLevels.WARNING);
});

test("Cards: missing QR chunk", async () => {
    const results = await testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt'], 'qrnumeric');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.MISSING_QR_CHUNK);
});

test("Cards: duplicated QR chunk index", async () => {
    const results = await testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt', 'example-02-f-qr-code-numeric-value-0.txt'], 'qrnumeric');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_NUMERIC_QR_HEADER);
});

test("Cards: QR chunk index out of range", async () => {
    const results = await testCard(['test-example-00-f-qr-code-numeric-value-0-index-out-of-range.txt'], 'qrnumeric');
    expect(results).toHaveLength(1);
    expect(results[0].code).toBe(ErrorCode.INVALID_NUMERIC_QR_HEADER);
});

test("Cards: QR chunk too big", async () => {
    const results = await testCard(['test-example-02-f-qr-code-numeric-value-0-qr_chunk_too_big.txt', 'test-example-02-f-qr-code-numeric-value-1-qr_chunk_too_big.txt'], 'qrnumeric');
    expect(results.map(r => r.code).indexOf(ErrorCode.INVALID_NUMERIC_QR) >= 0);
    expect(results.map(r => r.code).indexOf(ErrorCode.UNBALANCED_QR_CHUNKS) >= 0);
});



test("Cards: valid 00 FHIR bundle with non-dm properties", async () => expect(await testCard(['test-example-00-a-non-dm-properties.json'], "fhirbundle")).toHaveLength(5));

test("Cards: valid 00 FHIR bundle with non-short refs", async () => expect(await testCard(['test-example-00-a-short-refs.json'], "fhirbundle")).toHaveLength(5));