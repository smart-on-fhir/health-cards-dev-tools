// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { validateCard } from '../src/validate';
import { getFileData } from '../src/file';
import { ErrorCode as ec } from '../src/error';
import Log, { LogLevels } from '../src/logger';
import { get, isOpensslAvailable } from '../src/utils';
import { jreOrDockerAvailable } from '../src/fhirValidator';
import { IOptions, setOptions } from '../src/options';
import { ValidationProfiles, Validators } from '../src/fhirBundle';

const testdataDir = './testdata/';


// wrap testcard with a function that returns a function - now we don't need all 'async ()=> await' for every test case
function testCard(
    fileName: string | string[],
    fileType: ValidationType = 'healthcard',
    expected: (number | null | undefined | ec[])[] = [/*ERROR+FATAL*/0, /*WARNING*/0,/*INFO*/null,/*DEBUG*/null,/*FATAL*/null],
    options: Partial<IOptions> = {}) {

    return async () => {
        // NOTE: The X.509 cert corresponding to SHC spec's 2nd example key has expired (following the spec guidance on validity period)
        //       Many test files have been generated using that key, and we set a global validation time corresponding to before the
        //       cert expiration on June 1st, 2022, to avoid many cert expiration errors.
        const combinedOptions: Partial<IOptions> = { validationTime: "1653955200" /* 2022-05-31 */, ...options }
        await _testCard(fileName, fileType, expected, combinedOptions);
    }
}

async function _testCard(fileName: string | string[], fileType: ValidationType, expected: (number | null | undefined | ec[])[], options: Partial<IOptions>): Promise<void> {

    if (typeof fileName === 'string') fileName = [fileName];
    const files = [];
    for (const fn of fileName) {
        files.push(await getFileData(path.join(testdataDir, fn)));
    }

    const log = await validateCard(files, fileType, setOptions(options));
    const flatLog = log.flatten();

    const errors = [
        flatLog.filter(i => i.level >= LogLevels.ERROR),
        flatLog.filter(i => i.level === LogLevels.WARNING),
        flatLog.filter(i => i.level === LogLevels.INFO),
        flatLog.filter(i => i.level === LogLevels.DEBUG),
        flatLog.filter(i => i.level === LogLevels.FATAL)
    ];

    const errorLevelMap = [LogLevels.ERROR, LogLevels.WARNING, LogLevels.INFO, LogLevels.DEBUG, LogLevels.FATAL];

    // if only errors are specified warning will not get a default 0, so we'll set it here.
    if (expected.length === 1) expected[1] = 0;
    expected.length = 5;
    if (expected[0] === undefined) expected[0] = 0;

    for (let i = 0; i < errors.length; i++) {
        const exp = expected[i];
        const err = errors[i];

        if (Number.isInteger(exp)) {
            if (err.length !== exp) {
                console.debug(`Unexpected number of type ${LogLevels[errorLevelMap[i]]}. Expected ${(exp as number).toString()}, returned : ${err.length.toString()}`);
                err.forEach((e) => {
                    console.debug(`    ${ec[e.code]}|${e.code}|${e.message}`);
                });
            }

            if (err.length !== exp) {
                console.debug(log.toString(options.logLevel ?? LogLevels.DEBUG));
            }

            expect(err.length).toBe(exp);

        }

        if (exp instanceof Array) {
            // then number of expected errors should equal the number of actual errors
            expect(err).toHaveLength(exp.length);
            for (let j = 0; j < err.length; j++) {
                // -1 if expected error code not found
                const expectedErrorFound = exp.indexOf(err[j].code) > -1;
                if (!expectedErrorFound) {
                    console.debug(`Unexpected error ${ec[err[j].code]}|${err[j].code}|${err[j].message}`);
                }
                expect(expectedErrorFound).toBeTruthy();
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
if (!OPENSSL_AVAILABLE) {
    Log.Exclusions.add(ec.OPENSSL_NOT_AVAILABLE);
}
// for now, we get many not-short-url warnings for every use of example-02'
const SHORT_URL_WARNINGS = 110;
const SCHEMA_ERROR_ARRAY = (new Array(SHORT_URL_WARNINGS)).fill(ec.FHIR_SCHEMA_ERROR as never);
const JWS_TOO_LONG_WARNING = 1;


test("Cards: valid 00 FHIR bundle", testCard(['example-00-a-fhirBundle.json'], "fhirbundle"));
test("Cards: valid 01 FHIR bundle", testCard(['example-01-a-fhirBundle.json'], "fhirbundle"));
test("Cards: valid 02 FHIR bundle", testCard(['example-02-a-fhirBundle.json'], "fhirbundle", [SHORT_URL_WARNINGS]));
test("Cards: valid 03 FHIR bundle", testCard(['example-03-a-fhirBundle.json'], "fhirbundle"));

test("Cards: valid 00 JWS payload expanded", testCard(['example-00-b-jws-payload-expanded.json'], "jwspayload"));
test("Cards: valid 01 JWS payload expanded", testCard(['example-01-b-jws-payload-expanded.json'], "jwspayload"));
test("Cards: valid 02 JWS payload expanded", testCard(['example-02-b-jws-payload-expanded.json'], "jwspayload", [SHORT_URL_WARNINGS]));
test("Cards: valid 03 JWS payload expanded", testCard(['example-03-b-jws-payload-expanded.json'], "jwspayload"));

test("Cards: valid 00 JWS payload minified", testCard(['example-00-c-jws-payload-minified.json'], "jwspayload"));
test("Cards: valid 01 JWS payload minified", testCard(['example-01-c-jws-payload-minified.json'], "jwspayload"));
test("Cards: valid 02 JWS payload minified", testCard(['example-02-c-jws-payload-minified.json'], "jwspayload", [SHORT_URL_WARNINGS]));
test("Cards: valid 03 JWS payload minified", testCard(['example-03-c-jws-payload-minified.json'], "jwspayload"));

test("Cards: valid 00 JWS", testCard(['example-00-d-jws.txt'], "jws"));
test("Cards: valid 01 JWS", testCard(['example-01-d-jws.txt'], "jws"));
test("Cards: valid 02 JWS", testCard(['example-02-d-jws.txt'], "jws", [SHORT_URL_WARNINGS, JWS_TOO_LONG_WARNING]));
test("Cards: valid 03 JWS", testCard(['example-03-d-jws.txt'], "jws"));

test("Cards: valid 00 health card", testCard(['example-00-e-file.smart-health-card'], "healthcard"));
test("Cards: valid 01 health card", testCard(['example-01-e-file.smart-health-card'], "healthcard"));
test("Cards: valid 02 health card", testCard(['example-02-e-file.smart-health-card'], "healthcard", [SHORT_URL_WARNINGS, JWS_TOO_LONG_WARNING]));
test("Cards: valid 03 health card", testCard(['example-03-e-file.smart-health-card'], "healthcard"));

test("Cards: valid 00 QR numeric", testCard(['example-00-f-qr-code-numeric-value-0.txt'], "qrnumeric"));
test("Cards: valid 01 QR numeric", testCard(['example-01-f-qr-code-numeric-value-0.txt'], "qrnumeric"));
test("Cards: valid 02 QR numeric",
    testCard(['example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));
test("Cards: valid 02 QR numeric (out of order)",
    testCard(['example-02-f-qr-code-numeric-value-1.txt',
        'example-02-f-qr-code-numeric-value-0.txt',
        'example-02-f-qr-code-numeric-value-2.txt'], "qrnumeric", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));
test("Cards: valid 03 QR numeric", testCard(['example-03-f-qr-code-numeric-value-0.txt'], "qrnumeric"));
test("Cards: valid 1195-byte QR numeric", testCard(['test-example-1195-byte-qrnumeric.txt'], "qrnumeric"));

test("Cards: valid 00 QR code SVG", testCard(['example-00-g-qr-code-0.svg'], "qr"));
test("Cards: valid 01 QR code SVG", testCard(['example-01-g-qr-code-0.svg'], "qr"));

test("Cards: valid 00 QR code: requires scaling 23", testCard(['test-example-00-g-qr-code-0-scaled-23.jpg'], "qr"), 10 * 1000 /* 10-seconds*/);
test("Cards: valid 00 QR code: requires scaling 85", testCard(['test-example-00-g-qr-code-0-scaled-85.jpg'], "qr"), 10 * 1000 /* 10-seconds*/);

test("Cards: valid 02 QR code SVG",
    testCard(['example-02-g-qr-code-0.svg', 'example-02-g-qr-code-1.svg', 'example-02-g-qr-code-2.svg'], "qr", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));

test("Cards: valid 02 QR code PNG",
    testCard(['example-02-g-qr-code-0.png', 'example-02-g-qr-code-1.png', 'example-02-g-qr-code-2.png'], "qr", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));

test("Cards: valid 02 QR code JPG",
    testCard(['example-02-g-qr-code-0.jpg', 'example-02-g-qr-code-1.jpg', 'example-02-g-qr-code-2.jpg'], "qr", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));

test("Cards: valid 02 QR code BMP",
    testCard(['example-02-g-qr-code-0.bmp', 'example-02-g-qr-code-1.bmp', 'example-02-g-qr-code-2.bmp'], "qr", [[ec.QR_CHUNKING_DEPRECATED], [ec.JWS_TOO_LONG]], { exclude: ['fhir-schema-error'] }));

test("Cards: valid 03 QR code", testCard(['example-03-g-qr-code-0.svg'], "qr"));

test("Cards: valid 00 health card w/ multiple jws", testCard(['test-example-00-e-file-multi-jws.smart-health-card'], "healthcard"));

test("Cards: valid FHIR api health card", testCard(['test-example-00-fhirhealthcard.json'], "fhirhealthcard"));
test("Cards: valid FHIR api health card", testCard(['test-example-00-fhirhealthcard-multi-jws.json'], "fhirhealthcard"));
test("Cards: valid FHIR api health card with optional data", testCard(['test-example-00-fhirhealthcard-with-resource-link.json'], "fhirhealthcard"));

test("Cards: issuer in trusted directory ref by name", testCard(['example-00-d-jws.txt'], 'jws', [0], { issuerDirectory: 'test' }));
test("Cards: issuer in trusted directory ref by URL", testCard(['example-00-d-jws.txt'], 'jws', [0], { issuerDirectory: 'https://raw.githubusercontent.com/smart-on-fhir/health-cards-dev-tools/main/testdata/test-issuers.json' }));

// SMART Health Link valid cases
// These tests require the 'shl-server' be running. It will start automatically when running the 'test' script
// but you will need to start it manually if you are running individual tests
// Note: The local shl test server is not configured with an ssl cert, so it is listening on http (not https). We're ignoring the not-https-url errors in the tests below.
// Note: The shl test server data is read from the ./shl-server/shl folder when it starts
test("Cards: SHL QR", testCard(["shlink-qr.png"], "qr", [[ec.SHLINK_NOT_HTTPS_URL, ec.SHLINK_NOT_HTTPS_URL]], { passCode: "1234" }));
test("Cards: SHL Link", testCard(["shlink-link.txt"], "shlink", [[ec.SHLINK_NOT_HTTPS_URL, ec.SHLINK_NOT_HTTPS_URL]], { passCode: "1234" }));
test("Cards: SHL Link w/ Viewer", testCard(["shlink-link-with-viewer.txt"], "shlink", [[ec.SHLINK_NOT_HTTPS_URL, ec.SHLINK_NOT_HTTPS_URL]], { passCode: "1234" }));
test("Cards: SHL Payload", testCard(["shlink-payload.txt"], "shlpayload", [[ec.SHLINK_NOT_HTTPS_URL, ec.SHLINK_NOT_HTTPS_URL]], { passCode: "1234" }));
test("Cards: SHL Manifest", testCard(["shlink-manifest.txt"], "shlmanifest", [[ec.SHLINK_NOT_HTTPS_URL, ec.SHLINK_NOT_HTTPS_URL]], { decryptionKey: "v7SjEf2oC4nbbkrhJJ1VAsnp4QaAmrzwIVQtxGM7AIc" }));
test("Cards: SHL File", testCard(["shlink-manifest-file.txt"], "shlfile", [[ec.SHLINK_NOT_HTTPS_URL]], { decryptionKey: "v7SjEf2oC4nbbkrhJJ1VAsnp4QaAmrzwIVQtxGM7AIc" }));
test("Cards: SHL Link: bad passcode", testCard(["shlink-link.txt"], "shlink", [[ec.SHLINK_INVALID_PASSCODE]], { passCode: "12345" }));

// Warning cases

test("Cards: fhir bundle w/ trailing chars", testCard(['test-example-00-a-fhirBundle-trailing_chars.json'], 'fhirbundle', [[ec.TRAILING_CHARACTERS]]));
test("Cards: jws payload w/ trailing chars", testCard('test-example-00-b-jws-payload-expanded-trailing_chars.json', 'jwspayload', [[ec.TRAILING_CHARACTERS]]));
test("Cards: jws w/ trailing chars", testCard('test-example-00-d-jws-trailing_chars.txt', 'jws', [[ec.TRAILING_CHARACTERS]]));
test("Cards: health card w/ trailing chars", testCard('test-example-00-e-file-trailing_chars.smart-health-card', 'healthcard', [[ec.TRAILING_CHARACTERS]]));
test("Cards: numeric QR w/ trailing chars", testCard('test-example-00-f-qr-code-numeric-value-0-trailing_chars.txt', 'qrnumeric', [[ec.TRAILING_CHARACTERS]]));
test("Cards: jws too long", testCard('example-02-d-jws.txt', 'jws', [SCHEMA_ERROR_ARRAY, [ec.JWS_TOO_LONG]]));
test("Cards: not yet valid", testCard('test-example-00-b-jws-payload-expanded-nbf_not_yet_valid.json', 'jwspayload', [0, [ec.NOT_YET_VALID]]));
test("Cards: expired", testCard('test-example-00-b-jws-payload-expanded-expired.json', 'jwspayload', [0, [ec.EXPIRATION_ERROR]]));
test("Cards: exp in milliseconds", testCard('test-example-00-b-jws-payload-expanded-exp_milliseconds.json', 'jwspayload', [0, [ec.EXPIRATION_ERROR]]));
test("Cards: unnecessary QR chunks", testCard(['test-example-00-g-qr-code-0-qr_chunk_too_small.png', 'test-example-00-g-qr-code-1-qr_chunk_too_small.png'], 'qr', [[ec.QR_CHUNKING_DEPRECATED], [ec.INVALID_QR]]));
test("Cards: many unnecessary QR chunks", testCard([
    'test-example-00-f-qr-code-numeric-value-0-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-1-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-2-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-3-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-4-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-5-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-6-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-7-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-8-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-9-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-10-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-11-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-12-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-13-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-14-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-15-qr_chunk_too_small.txt',
    'test-example-00-f-qr-code-numeric-value-16-qr_chunk_too_small.txt'], 'qrnumeric', [[ec.QR_CHUNKING_DEPRECATED], [ec.INVALID_QR, ec.UNBALANCED_QR_CHUNKS]]));
test("Cards: missing immunization VC type", testCard('test-example-00-b-jws-payload-expanded-missing-imm-vc-type.json', 'jwspayload', [0, [ec.SCHEMA_ERROR]]));
test("Cards: missing covid VC type", testCard('test-example-00-b-jws-payload-expanded-missing-covid-vc-type.json', 'jwspayload', [0, [ec.SCHEMA_ERROR]]));
test("Cards: missing lab VC type", testCard('test-example-covid-lab-jwspayload-missing-lab-vc-type.json', 'jwspayload', [0, [ec.SCHEMA_ERROR]]));

test("Cards: missing coding",
    testCard('test-example-00-b-jws-payload-expanded-missing-coding.json', 'jwspayload', [[ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR], [ec.SCHEMA_ERROR]])
);

test("Cards: inflated QR code", testCard('test-example-00-g-qr-code-inflated-to-v22.png', 'qr', [0, [ec.INVALID_QR_VERSION]]));

// Error cases

test("Cards: invalid deflate",
    testCard(['test-example-00-e-file-invalid_deflate.smart-health-card'], 'healthcard', [[ec.INFLATION_ERROR]])
);

test("Cards: no deflate",
    testCard(['test-example-00-e-file-no_deflate.smart-health-card'], 'healthcard', [[ec.INFLATION_ERROR, ec.JWS_HEADER_ERROR], [ec.JWS_TOO_LONG]])
);

test("Cards: no JWS header 'alg'",
    testCard(['test-example-00-d-jws-no_jws_header_alg.txt'], 'jws', [[ec.JWS_HEADER_ERROR, ec.JWS_VERIFICATION_ERROR]])
);

test("Cards: no JWS header 'kid'",
    testCard(['test-example-00-d-jws-no_jws_header_kid.txt'], 'jws', [[ec.JWS_HEADER_ERROR, ec.JWS_VERIFICATION_ERROR]])
);

test("Cards: no JWS header 'zip'",
    testCard(['test-example-00-d-jws-no_jws_header_zip.txt'], 'jws', [[ec.JWS_HEADER_ERROR, ec.JWS_VERIFICATION_ERROR]])
);

test("Cards: wrong JWS header 'kid'",
    testCard(['test-example-00-d-jws-wrong_jws_header_kid.txt'], 'jws', [[ec.JWS_VERIFICATION_ERROR]])
);

test("Cards: JWS Payload with BOM UTF-8 prefix",
    testCard(['test-example-00-d-jws-utf8_bom_prefix.txt'], 'jws', [[ec.TRAILING_CHARACTERS, ec.TRAILING_CHARACTERS]])
);

test("Cards: CRL with invalid method", testCard(['badcrl/invalid-method/jws-crl-invalid-method.txt'], 'jws', [[ec.REVOCATION_ERROR]]));
test("Cards: CRL with invalid rid (base64)", testCard(['badcrl/non-base64url-rid/jws-crl-non-base64url-rid.txt'], 'jws', [[ec.REVOCATION_ERROR]]));
test("Cards: CRL with invalid rid (duplicate)", testCard(['badcrl/duplicate-rid/jws-crl-duplicate-rid.txt'], 'jws', [[ec.REVOCATION_ERROR, ec.REVOCATION_ERROR]]));
test("Cards: CRL with invalid rid (too long)", testCard(['badcrl/too-long-rid/jws-crl-too-long-rid.txt'], 'jws', [[ec.REVOCATION_ERROR]]));
test("Cards: CRL with version mismatch", testCard(['badcrl/version-mismatch/jws-crl-version-mismatch.txt'], 'jws', [[ec.REVOCATION_ERROR]]));

test("Cards: invalid issuer url",
    testCard(['test-example-00-e-file-invalid_issuer_url.smart-health-card'], 'healthcard', [[ec.ISSUER_KEY_DOWNLOAD_ERROR, ec.JWS_VERIFICATION_ERROR]], { clearKeyStore: true })
);

test("Cards: nbf in milliseconds",
    testCard(['test-example-00-b-jws-payload-expanded-nbf_milliseconds.json'], 'jwspayload', [[ec.NOT_YET_VALID]])
);

// one error for exp < nbf, one warning for card being expired
test("Cards: exp date before nbf", testCard('test-example-00-b-jws-payload-expanded-pre-expired.json', 'jwspayload', [[ec.EXPIRATION_ERROR], [ec.EXPIRATION_ERROR]]));

// the JWK's x5c value has the correct URL, so we get an extra x5c error due to URL mismatch
test("Cards: invalid issuer url (http)",
    testCard(['test-example-00-e-file-invalid_issuer_url_http.smart-health-card'], 'healthcard',
        [[ec.INVALID_ISSUER_URL].concat(OPENSSL_AVAILABLE ? [ec.INVALID_KEY_X5C] : [])])
);

// the JWK's x5c value has the correct URL, so we get an extra x5c error due to URL mismatch
test("Cards: invalid issuer url (trailing /)",
    testCard(['test-example-00-e-file-issuer_url_with_trailing_slash.smart-health-card'], 'healthcard', [[ec.INVALID_ISSUER_URL].concat(OPENSSL_AVAILABLE ? [ec.INVALID_KEY_X5C] : [])])
);

test("Cards: invalid JWK set",
    testCard(['test-example-00-e-file-bad_jwks.smart-health-card'], 'healthcard', [[ec.ISSUER_KEY_DOWNLOAD_ERROR, ec.JWS_VERIFICATION_ERROR]], { clearKeyStore: true })
);

test("Cards: invalid QR header",
    testCard(['test-example-00-f-qr-code-numeric-value-0-wrong_qr_header.txt'], 'qrnumeric', [[ec.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: wrong file extension",
    testCard(['test-example-00-e-file.wrong-extension'], 'healthcard', [0, [ec.INVALID_FILE_EXTENSION]])
);

test("Cards: invalid signature",
    testCard(['test-example-00-d-jws-invalid-signature.txt'], 'jws', [[ec.JWS_VERIFICATION_ERROR]])
);

test("Cards: invalid single chunk QR header",
    testCard(['test-example-00-f-qr-code-numeric-value-0-wrong-multi-chunk.txt'], 'qrnumeric', [0, [ec.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: missing QR chunk",
    testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt'], 'qrnumeric', [[ec.QR_CHUNKING_DEPRECATED, ec.MISSING_QR_CHUNK]])
);

test("Cards: duplicated QR chunk index",
    testCard(['example-02-f-qr-code-numeric-value-0.txt', 'example-02-f-qr-code-numeric-value-2.txt', 'example-02-f-qr-code-numeric-value-0.txt'], 'qrnumeric', [[ec.QR_CHUNKING_DEPRECATED, ec.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: QR chunk index out of range",
    testCard(['test-example-00-f-qr-code-numeric-value-0-index-out-of-range.txt', 'example-02-f-qr-code-numeric-value-1.txt'], 'qrnumeric', [[ec.QR_CHUNKING_DEPRECATED, ec.INVALID_NUMERIC_QR_HEADER]])
);

test("Cards: QR chunk too big",
    testCard(['test-example-02-f-qr-code-numeric-value-0-qr_chunk_too_big.txt', 'test-example-02-f-qr-code-numeric-value-1-qr_chunk_too_big.txt'], 'qrnumeric',
        [[ec.QR_CHUNKING_DEPRECATED, ec.INVALID_NUMERIC_QR, ec.INVALID_NUMERIC_QR], JWS_TOO_LONG_WARNING], { exclude: ['fhir-schema-error'] })
);

test("Cards: invalid numeric QR with odd count",
    testCard(['test-example-00-f-qr-code-numeric-value-0-odd-count.txt'], 'qrnumeric', [[ec.INVALID_NUMERIC_QR]])
);

test("Cards: invalid numeric QR with value too big",
    testCard(['test-example-00-f-qr-code-numeric-value-0-number-too-big.txt'], 'qrnumeric', [[ec.INVALID_NUMERIC_QR]])
);

test("Cards: single segment QR",
    testCard('test-example-00-g-qr-code-0-single_qr_segment.png', 'qr', [[ec.INVALID_QR, ec.INVALID_QR_VERSION]])
);

test("Cards: too many QR segments",
    testCard('test-example-00-g-qr-code-0-too_many_qr_segment.png', 'qr', [[ec.INVALID_QR, ec.INVALID_NUMERIC_QR]])
);

test("Cards: invalid QR version",
    testCard('test-example-00-g-qr-code-0-bad_qr_version.png', 'qr', [[ec.INVALID_QR_VERSION], [ec.INVALID_QR_VERSION]])
);

test("Cards: corrupted QR code",
    testCard(['test-example-00-g-qr-code-0-corrupted.png'], 'qr', [[ec.QR_DECODE_ERROR]])
);

test("Cards: invalid JWS payload encoding (double-stringify)",
    testCard(['test-invalid-jws-payload.png'], 'qr', [[ec.JSON_PARSE_ERROR]])
);

test("Cards: valid 00 FHIR bundle with non-dm properties", testCard(['test-example-00-a-non-dm-properties.json'], "fhirbundle", [0, 5 /*5x ErrorCode.SCHEMA_ERROR*/]));

test("Cards: valid 00 FHIR bundle with non-short refs", testCard(['test-example-00-a-short-refs.json'], "fhirbundle", [7 /*7x ErrorCode.SCHEMA_ERROR*/]));

test("Cards: der encoded signature", testCard(['test-example-00-d-jws-der-signature.txt'], 'jws', [[ec.SIGNATURE_FORMAT_ERROR]]));

test("Cards: der encoded signature s-negative", testCard(['test-example-00-d-jws-der-signature-s-neg.txt'], 'jws', [[ec.SIGNATURE_FORMAT_ERROR]]));

test("Cards: der encoded signature r-negative", testCard(['test-example-00-d-jws-der-signature-r-neg.txt'], 'jws', [[ec.SIGNATURE_FORMAT_ERROR]]));

test("Cards: der encoded signature r&s negative", testCard(['test-example-00-d-jws-der-signature-rs-neg.txt'], 'jws', [[ec.SIGNATURE_FORMAT_ERROR]]));

test("Cards: bad meta with extra key", testCard(['test-example-00-a-fhirBundle-bad_meta_extra_key.json'], 'fhirbundle', [0, [ec.FHIR_SCHEMA_ERROR]]));

test("Cards: bad meta without security key", testCard(['test-example-00-a-fhirBundle-bad_meta_non_security.json'], 'fhirbundle', [0, [ec.FHIR_SCHEMA_ERROR]]));

test("Cards: bad meta with wrong security field", testCard(['test-example-00-a-fhirBundle-bad_meta_wrong_security.json'], 'fhirbundle', [[ec.FHIR_SCHEMA_ERROR]]));

test("Cards: health card w/ multi-jws and issues",
    testCard(['test-example-00-e-file-multi-jws-issues.smart-health-card'], "healthcard",
        [[ec.JWS_HEADER_ERROR, ec.JWS_VERIFICATION_ERROR, ec.TRAILING_CHARACTERS]])
);

test("Cards: fhir bundle w/ usa-profile errors", testCard(['test-example-00-a-fhirBundle-profile-usa.json'], 'fhirbundle',
    [[ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.PROFILE_ERROR, ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR]], { profile: ValidationProfiles['usa-covid19-immunization'] }));

test("Cards: fhir bundle w/ empty elements", testCard(['test-example-00-a-fhirBundle-empty-values.json'], 'fhirbundle',
    [[ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR]]));

test("Cards: fhir bundle w/ missing occurrence & extra occurrence", testCard(['test-example-00-a-fhirBundle-occurrence-issues.json'], 'fhirbundle', [[ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR]]));

test("Cards: missing SHC VC type", testCard('test-example-00-b-jws-payload-expanded-missing-shc-vc-type.json', 'jwspayload', [[ec.SCHEMA_ERROR]]));

test("Cards: issuer not in trusted directory", testCard(['example-00-d-jws.txt'], 'jws', [[ec.ISSUER_NOT_TRUSTED]], { issuerDirectory: 'VCI' }));

test("Cards: un-needed VC type", testCard('test-example-00-b-jws-payload-expanded-optional-vc-type.json', 'jwspayload', [0, [ec.SCHEMA_ERROR]]));

test("Cards: unknown VC types", testCard('test-example-00-b-jws-payload-expanded-unknown-vc-types.json', 'jwspayload', [0, [ec.SCHEMA_ERROR, ec.SCHEMA_ERROR]]));

test("Cards: mismatch kid/issuer", testCard(['test-example-00-d-jws-issuer-kid-mismatch.txt'], "jws", [[ec.ISSUER_KID_MISMATCH]], { jwkset: 'testdata/issuer.jwks.public.not.smart.json' }));

test("Cards: immunization status not 'completed'", testCard('test-example-00-a-fhirBundle-status-not-completed.json', 'fhirbundle', [[ec.FHIR_SCHEMA_ERROR, ec.FHIR_SCHEMA_ERROR]]));


// Tests using the HL7 FHIR Validator
// Since these tests require a Java runtime (JRE) or Docker to be installed, they are conditionally executed.
// These tests can also take a longer as they have to spin up a Docker image 
describe('FHIR validator tests', () => {

    const testif = (condition: boolean) => condition ? it : it.skip;
    const canRunFhirValidator = jreOrDockerAvailable();
    // shc-validator -p ./testdata/test-example-00-a-fhirBundle-profile-usa.json -t fhirbundle -l debug -V fhirvalidator
    testif(canRunFhirValidator)("Cards: fhir validator test", testCard(['test-example-00-a-fhirBundle-profile-usa.json'], 'fhirbundle',
        [8, 1], { validator: Validators.fhirvalidator, logLevel: LogLevels.DEBUG }), 1000 * 60 * 5 /*5 minutes*/);

});

afterAll(async () => {
    // send request to shutdown shl server
    // await get('http://localhost:8090/exit')
});
