import * as api from '../src/api';
import fs from 'fs';
import path from 'path';
import { ErrorCode as ec, LogLevels, Validators, IOptions } from '../src/api';
import { jreOrDockerAvailable } from '../src/fhirValidator';

const testdataDir = './testdata/';


// wrap validateApi with a function that returns a function - now we don't need all 'async ()=> await' for every test case
function validateApi(
    filePath: string[] | string,
    type: string,
    expected: (number | null | undefined | ec[] | Error)[] = [/*ERROR+FATAL*/0, /*WARNING*/0,/*INFO*/null,/*DEBUG*/null,/*FATAL*/null],
    options: Partial<IOptions> = {}) {
    return async () => {
        // NOTE: The X.509 cert corresponding to SHC spec's 2nd example key has expired (following the spec guidance on validity period)
        //       Many test files have been generated using that key, and we set a global validation time corresponding to before the
        //       cert expiration on June 1st, 2022, to avoid many cert expiration errors.
        const combinedOptions: Partial<IOptions> = {validationTime: "1653955200" /* 2022-05-31 */, ...options }
        await _validateApi(filePath, type, expected, combinedOptions);
    }
}

async function _validateApi(filePath: string[] | string, type: string, expected: (number | null | undefined | ec[] | Error)[], options: Partial<IOptions> = {}): Promise<void> {

    let data: string[] = [];
    let url = '';

    if (typeof filePath === 'string') {
        url = filePath;
    } else {
        data = filePath.map(p => fs.readFileSync(path.join(testdataDir, p)).toString('utf-8'));
    }

    let p: Promise<api.ValidationErrors>;

    switch (type) {

        case 'qrnumeric':
            p = api.validate.qrnumeric(data, options);
            break;
        case 'healthcard':
            p = api.validate.healthcard(data[0], options);
            break;
        case 'fhirhealthcard':
            p = api.validate.fhirhealthcard(data[0], options);
            break;
        case 'jws':
            p = api.validate.jws(data[0], options);
            break;
        case 'jwspayload':
            p = api.validate.jwspayload(data[0], options);
            break;
        case 'fhirbundle':
            p = api.validate.fhirbundle(data[0], options);
            break;
        case 'keyset':
            p = api.validate.keyset(data[0], options);
            break;
        case 'trusteddirectory':
            p = api.validate.checkTrustedDirectory(url, options);
            break;
        default:
            throw new Error(`Unknown validation type: ${type}`);
    }

    let log = await p.catch((error) => {
        expect([error]).toStrictEqual(expected);
    });

    if (!log) return;

    // no error occurred when error was expected
    if (expected[0] instanceof Error) {
        throw new Error('Error not thrown');
    }

    // skip the no-openssl warning
    log = log.filter(e => e.code !== api.ErrorCode.OPENSSL_NOT_AVAILABLE);


    // partition the errors by level [error[], warning[], info[], debug[], fatal[]]
    const errors = [
        log.filter(i => i.level >= LogLevels.ERROR),
        log.filter(i => i.level === LogLevels.WARNING),
        log.filter(i => i.level === LogLevels.INFO),
        log.filter(i => i.level === LogLevels.DEBUG),
        log.filter(i => i.level === LogLevels.FATAL)
    ];

    // if only 'errors' are specified warning will not get a default 0, so we'll set it here.
    if (expected.length === 1) expected[1] = 0;
    expected.length = 5;

    for (let i = 0; i < errors.length; i++) {
        const exp = expected[i];
        const err = errors[i];

        if (Number.isInteger(exp)) {

            if(err.length !== exp) {
                console.debug(JSON.stringify(log));
            }

            expect(err.length).toBe(exp);
        }

        if (exp instanceof Array) {

            if(err.length !== exp.length) {
                console.debug(JSON.stringify(log));
            }

            // then number of expected errors should equal the number of actual errors
            expect(err).toHaveLength(exp.length);
            for (let j = 0; j < err.length; j++) {
                // -1 if expected error code not found
                expect(exp.indexOf(err[j].code)).toBeGreaterThanOrEqual(0);
            }
        }
    }
}

//
// This api works differently than the command-line tool. Errors are not bubbled-up from child artifacts.
// For example, when validating a health-card, the contained jws string is not validated, just
// the surrounding health-card. The jws content would need to be validated with an additional call.
//


// Tests using the HL7 FHIR Validator
// Since these tests require a Java runtime (JRE) or Docker to be installed, they are conditionally executed.
// These tests can also take a longer as they have to spin up a Docker image 
describe('FHIR validator tests', () => {
    const testif = (condition: boolean) => condition ? it : it.skip;
    const canRunFhirValidator = jreOrDockerAvailable();
    testif(canRunFhirValidator)('fhirbundle: validator=fhirvalidator', validateApi(['test-example-00-a-fhirBundle-profile-usa.json'], 'fhirbundle', 
    [Array(8).fill(ec.FHIR_VALIDATOR_ERROR), [ec.FHIR_VALIDATOR_ERROR]], { validator: Validators.fhirvalidator, logLevel: LogLevels.DEBUG  }), 1000 * 60 * 5 /*5 minutes*/);
});
