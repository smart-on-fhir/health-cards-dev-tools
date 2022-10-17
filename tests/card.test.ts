// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import { validateCard } from '../src/validate';
import { getFileData } from '../src/file';
import { ErrorCode as ec } from '../src/error';
import Log, { LogLevels } from '../src/logger';
import { isOpensslAvailable } from '../src/utils';
import { jreOrDockerAvailable } from '../src/fhirValidator';
import { IOptions, setOptions } from '../src/options';
import { Validators } from '../src/fhirBundle';

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
        const combinedOptions: Partial<IOptions> = {validationTime: "1653955200" /* 2022-05-31 */, ...options }
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
                console.debug(log.toString(LogLevels.DEBUG));
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


// Tests using the HL7 FHIR Validator
// Since these tests require a Java runtime (JRE) or Docker to be installed, they are conditionally executed.
// These tests can also take a longer as they have to spin up a Docker image 
// describe('FHIR validator tests', () => {

//     const testif = (condition: boolean) => condition ? it : it.skip;
//     const canRunFhirValidator = jreOrDockerAvailable();
//     // shc-validator -p ./testdata/test-example-00-a-fhirBundle-profile-usa.json -t fhirbundle -l debug -V fhirvalidator
//     testif(canRunFhirValidator)("Cards: fhir x validator test", testCard(['test-example-00-a-fhirBundle-profile-usa.json'], 'fhirbundle',
//         [8, 1], { validator: Validators.fhirvalidator, logLevel: LogLevels.DEBUG }), 1000 * 60 * 5 /*5 minutes*/);

// });

