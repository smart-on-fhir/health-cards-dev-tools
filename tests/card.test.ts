// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { validateCard, ValidationType } from '../src/validate';
import { getFileData } from '../src/file';
import { ErrorCode } from '../src/error';
import { LogLevels } from '../src/logger';
import { isOpensslAvailable } from '../src/utils';

const testdataDir = './testdata/';

// wrap testcard with a function that returns a function - now we don't need all 'async ()=> await' for every test case
function testCard(fileName: string | string[], fileType: ValidationType = 'healthcard', expected: (number | null | undefined | ErrorCode[])[] = [/*ERROR+FATAL*/0, /*WARNING*/0,/*INFO*/null,/*DEBUG*/null,/*FATAL*/null]) {
    return async ()=> {
         await _testCard(fileName, fileType, expected);
    }
}

async function _testCard(fileName: string | string[], fileType: ValidationType , expected: (number | null | undefined | ErrorCode[])[]): Promise<void> {
    
    if (typeof fileName === 'string') fileName = [fileName];
    const files = [];
    for (const fn of fileName) {
        files.push(await getFileData(path.join(testdataDir, fn)));
    }
    const log = (await validateCard(files, fileType)).log.flatten();

    const errors = [
        log.filter(i => i.level >= LogLevels.ERROR),
        log.filter(i => i.level === LogLevels.WARNING),
        log.filter(i => i.level === LogLevels.INFO),
        log.filter(i => i.level === LogLevels.DEBUG),
        log.filter(i => i.level === LogLevels.FATAL)
    ];

    // if only errors are specified warning will not get a default 0, so we'll set it here.
    if (expected.length === 1) expected[1] = 0;
    expected.length = 5;

    for (let i = 0; i < errors.length; i++) {
        const exp = expected[i];
        const err = errors[i];

        if (Number.isInteger(exp)) {
            expect(err.length).toBe(exp);
        }

        if (exp instanceof Array) {
            // then number of expected errors should equal the number of actual errors
            expect(err).toHaveLength(exp.length);
            for (let j = 0; j < err.length; j++) {
                // -1 if expected error code not found
                expect(exp.indexOf(err[j].code)).toBeGreaterThanOrEqual(0);
            }
        }
    }

}

// Test valid examples from spec

/*
    Expected errors are passed as an array.
    [expected fatal+errors, warnings, info, debug, fatal-only]

    fatal-only is provided if you want to differentiate a fatal error from regular errors

    If you don't include elements info, debug, and fatal-only those types will be ignored
    for example, [1,2] will expect 1-error and 2-warnings and ignore debug and info type log items.
    [null, 2] will ignore errors and expect 2-warnings

    passing nothing is equivalent to [0,0] (expect no errors or warnings)

    you may also specify specific error codes as and array
    for example, [1, [ErrorCode.INFLATION_ERROR, ErrorCode.JSON_PARSE_ERROR]] will expect 1-error, 1-inflation-warning, and 1-json-parse-warning

    warnings are checked by default, so [1] is the equivalent of [1,0]. If you want to ignore warnings, pass a null [1, null]

    you cannot combine an expected count + specific error codes for a given error type.
    for example, you may specify an expected error count as a number or as an array of expected error codes - not both.

    if you expect 2 error codes of the same type, you must include that code twice (e.g. [0, [ErrorCode.SCHEMA_ERROR, ErrorCode.SCHEMA_ERROR]])
    or use the less-specific [0, 2]
*/

// Check if openssl is available. If not, this will add a warning in many tests where an issuer key
// set contains a key with a x5c value. Hard to automate because tests that fail before parsing the JWS
// won't add this warning.
const OPENSSL_AVAILABLE = isOpensslAvailable();
const OPENSSL_WARNING = OPENSSL_AVAILABLE ? 0 : 1;
// for now, we get many not-short-url warnings for every use of example-02'
const SHORT_URL_WARNINGS = 55;
const SCHEMA_ERROR_ARRAY = Array.apply(null, Array(SHORT_URL_WARNINGS)).map(() => ErrorCode.SCHEMA_ERROR);
const JWS_TOO_LONG_WARNING = 1;

test("Cards: valid 00 FHIR bundle", testCard(['example-00-a-fhirBundle.json'], "fhirbundle"));
test("Cards: valid 01 FHIR bundle", testCard(['example-01-a-fhirBundle.json'], "fhirbundle"));
test("Cards: valid 02 FHIR bundle", testCard(['example-02-a-fhirBundle.json'], "fhirbundle", [0, SHORT_URL_WARNINGS]));

test("Cards: valid 00 JWS payload expanded", testCard(['example-00-b-jws-payload-expanded.json'], "jwspayload"));
test("Cards: valid 01 JWS payload expanded", testCard(['example-01-b-jws-payload-expanded.json'], "jwspayload"));
test("Cards: valid 02 JWS payload expanded", testCard(['example-02-b-jws-payload-expanded.json'], "jwspayload", [0, SHORT_URL_WARNINGS]));

test("Cards: valid 00 JWS payload minified", testCard(['example-00-c-jws-payload-minified.json'], "jwspayload"));
test("Cards: valid 01 JWS payload minified", testCard(['example-01-c-jws-payload-minified.json'], "jwspayload"));
test("Cards: valid 02 JWS payload minified", testCard(['example-02-c-jws-payload-minified.json'], "jwspayload", [0, SHORT_URL_WARNINGS]));

test("Cards: valid 00 JWS", testCard(['example-00-d-jws.txt'], "jws", [0, OPENSSL_WARNING]));
test("Cards: valid 01 JWS", testCard(['example-01-d-jws.txt'], "jws", [0, OPENSSL_WARNING]));
test("Cards: valid 02 JWS", testCard(['example-02-d-jws.txt'], "jws", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 00 health card", testCard(['example-00-e-file.smart-health-card'], "healthcard", [0, OPENSSL_WARNING]));
test("Cards: valid 01 health card", testCard(['example-01-e-file.smart-health-card'], "healthcard", [0, OPENSSL_WARNING]));
test("Cards: valid 02 health card", testCard(['example-02-e-file.smart-health-card'], "healthcard", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 00 QR numeric", testCard(['example-00-f-qr-code-numeric-value-0.txt'], "qrnumeric", [0, OPENSSL_WARNING]));
test("Cards: valid 01 QR numeric", testCard(['example-01-f-qr-code-numeric-value-0.txt'], "qrnumeric", [0, OPENSSL_WARNING]));
test("Cards: valid 02 QR numeric",  
    testCard(['example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));
test("Cards: valid 02 QR numeric (out of order)", 
    testCard(['example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 00 QR code", testCard(['example-00-g-qr-code-0.svg'], "qr", [0, OPENSSL_WARNING]));
test("Cards: valid 01 QR code", testCard(['example-01-g-qr-code-0.svg'], "qr", [0, OPENSSL_WARNING]));

test("Cards: valid 02 QR code", 
    testCard(['example-02-g-qr-code-0.svg', 'example-02-g-qr-code-1.svg', 'example-02-g-qr-code-2.svg'], "qr", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 02 QR code PNG", 
    testCard(['example-02-g-qr-code-0.png', 'example-02-g-qr-code-1.png', 'example-02-g-qr-code-2.png'], "qr", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 02 QR code JPG", 
    testCard(['example-02-g-qr-code-0.jpg', 'example-02-g-qr-code-1.jpg', 'example-02-g-qr-code-2.jpg'], "qr", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

test("Cards: valid 02 QR code BMP",
    testCard(['example-02-g-qr-code-0.bmp', 'example-02-g-qr-code-1.bmp', 'example-02-g-qr-code-2.bmp'], "qr", [0, SHORT_URL_WARNINGS + JWS_TOO_LONG_WARNING + OPENSSL_WARNING]));

// Warning cases

test("Cards: fhir bundle w/ trailing chars", testCard(['test-example-00-a-fhirBundle-trailing_chars.json'], 'fhirbundle', [0, [ErrorCode.TRAILING_CHARACTERS]]));
test("Cards: jws payload w/ trailing chars", testCard('test-example-00-b-jws-payload-expanded-trailing_chars.json', 'jwspayload', [0, [ErrorCode.TRAILING_CHARACTERS]]));
test("Cards: jws w/ trailing chars", testCard('test-example-00-d-jws-trailing_chars.txt', 'jws', [0, [ErrorCode.TRAILING_CHARACTERS].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE])]));
test("Cards: health card w/ trailing chars", testCard('test-example-00-e-file-trailing_chars.smart-health-card', 'healthcard', [0, [ErrorCode.TRAILING_CHARACTERS].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE])]));
test("Cards: numeric QR w/ trailing chars", testCard('test-example-00-f-qr-code-numeric-value-0-trailing_chars.txt', 'qrnumeric', [0, [ErrorCode.TRAILING_CHARACTERS].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE])]));

test("Cards: jws too long", testCard('example-02-d-jws.txt', 'jws', [0, [ErrorCode.JWS_TOO_LONG].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE]).concat(SCHEMA_ERROR_ARRAY)]));

// Error cases

test("Cards: invalid deflate", 
    testCard(['test-example-00-e-file-invalid_deflate.smart-health-card'], 'healthcard', [[ErrorCode.INFLATION_ERROR, ErrorCode.JSON_PARSE_ERROR]])
);

test("Cards: no deflate", 
    testCard(['test-example-00-e-file-no_deflate.smart-health-card'], 'healthcard', [[ErrorCode.INFLATION_ERROR, ErrorCode.JSON_PARSE_ERROR],[ErrorCode.JWS_TOO_LONG]])
);

test("Cards: invalid issuer url", 
    testCard(['test-example-00-e-file-invalid_issuer_url.smart-health-card'], 'healthcard', [[ErrorCode.ISSUER_KEY_DOWNLOAD_ERROR]])
);

// the JWK's x5c value has the correct URL, so we get an extra x5c error due to URL mismatch
test("Cards: invalid issuer url (http)", 
    testCard(['test-example-00-e-file-invalid_issuer_url_http.smart-health-card'], 'healthcard', [[ErrorCode.INVALID_ISSUER_URL].concat(OPENSSL_AVAILABLE ? [ErrorCode.INVALID_KEY_X5C] : []), OPENSSL_WARNING])
);

// the JWK's x5c value has the correct URL, so we get an extra x5c error due to URL mismatch
test("Cards: invalid issuer url (trailing /)", 
    testCard(['test-example-00-e-file-issuer_url_with_trailing_slash.smart-health-card'], 'healthcard', [[ErrorCode.INVALID_ISSUER_URL].concat(OPENSSL_AVAILABLE ? [ErrorCode.INVALID_KEY_X5C] : []), OPENSSL_WARNING])
);

test("Cards: invalid QR header", 
    testCard(['test-example-00-f-qr-code-numeric-wrong_qr_header.txt'], 'qrnumeric', [[ErrorCode.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: wrong file extension", 
    testCard(['test-example-00-e-file.wrong-extension'], 'healthcard', [0, [ErrorCode.INVALID_FILE_EXTENSION].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE])])
);

test("Cards: invalid signature", 
    testCard(['test-example-00-d-jws-invalid-signature.txt'], 'jws', [[ErrorCode.JWS_VERIFICATION_ERROR], OPENSSL_WARNING])
);

test("Cards: invalid single chunk QR header", 
    testCard(['test-example-00-f-qr-code-numeric-value-0-wrong-multi-chunk.txt'], 'qrnumeric', [0, [ErrorCode.INVALID_NUMERIC_QR_HEADER].concat(OPENSSL_AVAILABLE ? [] : [ErrorCode.OPENSSL_NOT_AVAILABLE])])
);

test("Cards: missing QR chunk", 
    testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt'], 'qrnumeric', [[ErrorCode.MISSING_QR_CHUNK]])
);

test("Cards: duplicated QR chunk index", 
    testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt', 'example-02-f-qr-code-numeric-value-0.txt'], 'qrnumeric', [[ErrorCode.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: QR chunk index out of range",
    testCard(['test-example-00-f-qr-code-numeric-value-0-index-out-of-range.txt','example-02-f-qr-code-numeric-value-1.txt'], 'qrnumeric', [[ErrorCode.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: QR chunk too big",
    testCard(['test-example-02-f-qr-code-numeric-value-0-qr_chunk_too_big.txt', 'test-example-02-f-qr-code-numeric-value-1-qr_chunk_too_big.txt'], 'qrnumeric', [[ErrorCode.INVALID_NUMERIC_QR, ErrorCode.INVALID_NUMERIC_QR], JWS_TOO_LONG_WARNING + SHORT_URL_WARNINGS + OPENSSL_WARNING])
);

test("Cards: valid 00 FHIR bundle with non-dm properties", testCard(['test-example-00-a-non-dm-properties.json'], "fhirbundle", [0, 5 /*5x ErrorCode.SCHEMA_ERROR*/]));

test("Cards: valid 00 FHIR bundle with non-short refs", testCard(['test-example-00-a-short-refs.json'], "fhirbundle", [0, 4 /*4x ErrorCode.SCHEMA_ERROR*/]));

