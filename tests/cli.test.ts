// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import { runCommandSync } from '../src/command';
import { ErrorCode as ec } from '../src/error';
import { LogItem } from '../src/logger';
import { CliOptions } from '../src/shc-validator';
import { isOpensslAvailable } from '../src/utils';

const OPENSSL_AVAILABLE = isOpensslAvailable();
// NOTE: The X.509 cert corresponding to SHC spec's 2nd example key has expired (following the spec guidance on validity period)
//       Many test files have been generated using that key, and we set a global validation time corresponding to before the
//       cert expiration on June 1st, 2022, to avoid many cert expiration errors.
const validationTime = "1653955200"; /* 2022-05-31 */

interface LogEntry {
    time: string,
    options: CliOptions,
    log: LogItem[]
}



// Puts the standard output into an array of line, 
// grouping multi-line json into single lines and prefixing with JSON:
function parseStdout(stdout: string): string[] {

    const lines = stdout.split('\n');
    const out: string[] = [];
    let jsonStart = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '{') jsonStart = i;
        if (lines[i] === '}') {
            out.push("JSON:" + lines.slice(jsonStart, i + 1).join(''));
            jsonStart = -1;
            continue;
        }
        if (lines[i].substring(0, 1) === "{" && lines[i].slice(-1) === "}") lines[i] = "JSON:" + lines[i];
        if (jsonStart === -1) out.push(lines[i]);
    }

    return out;
}


function testLogFile(logPath: string, deleteLog = true): LogEntry[] {

    expect(fs.existsSync(logPath)).toBe(true);

    const fileText = fs.readFileSync(logPath).toString('utf8');

    expect(typeof fileText).toBe('string');

    const logs = JSON.parse(fileText) as LogEntry[];

    expect(Array.isArray(logs)).toBe(true);

    if (deleteLog) fs.rmSync(logPath);

    let d0 = new Date(0);

    logs.forEach(entry => {
        const de = new Date(entry.time);
        expect(Number.isNaN(de)).toBe(false);
        expect(de >= d0).toBe(true);
        expect(Array.isArray(entry.log)).toBe(true);
        expect(entry.options).toBeDefined();
        d0 = de;
    });

    return logs;
}

function testCliCommand(command: string): number {
    const commandResult = runCommandSync(command);
    const out = parseStdout(commandResult.stdout);
    console.log(out.join('\n'));
    return commandResult.exitCode;
}

// Valid calls to examples
test("Cards: valid 00 health card", () => expect(testCliCommand(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info --jwkset testdata/issuer.jwks.public.json --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 jws", () => expect(testCliCommand(`node . --path testdata/example-00-d-jws.txt --type jws --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 jws-payload", () => expect(testCliCommand(`node . --path testdata/example-00-c-jws-payload-minified.json --type jwspayload --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 fhirBundle", () => expect(testCliCommand(`node . --path testdata/example-00-a-fhirBundle.json --type fhirbundle --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 qr-code-numeric", () => expect(testCliCommand(`node . --path testdata/example-00-f-qr-code-numeric-value-0.txt --type qrnumeric --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 qr-code.svg", () => expect(testCliCommand(`node . --path testdata/example-00-g-qr-code-0.svg --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 00 qr-code scaling", () => expect(testCliCommand(`node . --path testdata/test-example-00-g-qr-code-0-scaled-23.jpg --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));

test("Cards: valid 01 health card", () => expect(testCliCommand(`node . --path testdata/example-01-e-file.smart-health-card --type healthcard --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 01 jws", () => expect(testCliCommand(`node . --path testdata/example-01-d-jws.txt --type jws --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 01 jws-payload", () => expect(testCliCommand(`node . --path testdata/example-01-c-jws-payload-minified.json --type jwspayload --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 01 fhirBundle", () => expect(testCliCommand(`node . --path testdata/example-01-a-fhirBundle.json --type fhirbundle --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 01 qr-code-numeric", () => expect(testCliCommand(`node . --path testdata/example-01-f-qr-code-numeric-value-0.txt --type qrnumeric --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 01 qr-code.svg", () => expect(testCliCommand(`node . --path testdata/example-01-g-qr-code-0.svg --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));

test("Cards: valid 02 health card", () => expect(testCliCommand(`node . --path testdata/example-02-e-file.smart-health-card --type healthcard --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 jws", () => expect(testCliCommand(`node . --path testdata/example-02-d-jws.txt --type jws --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 jws-payload", () => expect(testCliCommand(`node . --path testdata/example-02-c-jws-payload-minified.json --type jwspayload --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 fhirBundle", () => expect(testCliCommand(`node . --path testdata/example-02-a-fhirBundle.json --type fhirbundle --loglevel warning --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 qr-code-numeric", () => expect(testCliCommand(`node . --path testdata/example-02-f-qr-code-numeric-value-0.txt --path testdata/example-02-f-qr-code-numeric-value-1.txt --path testdata/example-02-f-qr-code-numeric-value-2.txt --type qrnumeric --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 qr-code.svg", () => expect(testCliCommand(`node . --path testdata/example-02-g-qr-code-0.svg --path testdata/example-02-g-qr-code-1.svg --path testdata/example-02-g-qr-code-2.svg --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 qr-code.png", () => expect(testCliCommand(`node . --path testdata/example-02-g-qr-code-0.png --path testdata/example-02-g-qr-code-1.png --path testdata/example-02-g-qr-code-2.png --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 qr-code.jpg", () => expect(testCliCommand(`node . --path testdata/example-02-g-qr-code-0.jpg --path testdata/example-02-g-qr-code-1.jpg --path testdata/example-02-g-qr-code-2.jpg --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));
test("Cards: valid 02 qr-code.bmp", () => expect(testCliCommand(`node . --path testdata/example-02-g-qr-code-0.bmp --path testdata/example-02-g-qr-code-1.bmp --path testdata/example-02-g-qr-code-2.bmp --type qr --loglevel info --valTime ${validationTime}`)).toBe(0));

test("Cards: valid fhir api health card", () => expect(testCliCommand(`node . --path testdata/test-example-00-fhirhealthcard.json --type fhirhealthcard --loglevel info --jwkset testdata/issuer.jwks.public.json --valTime ${validationTime}`)).toBe(0));

// valid key example
test("Cards: valid key set", () => expect(testCliCommand(`node . --path testdata/issuer.jwks.public.json --type jwkset --loglevel info --valTime ${validationTime}`)).toBe(0));

// Bad paths to data files
test("Cards: missing healthcard", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type healthcard --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));
test("Cards: missing jws", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jws --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));
test("Cards: missing jwspayload", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jwspayload --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));
test("Cards: missing fhirbundle", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type fhirbundle --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));
test("Cards: missing qrnumeric", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qrnumeric --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));
test("Cards: missing qr", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qr --loglevel info')).toBe(ec.DATA_FILE_NOT_FOUND));

// Log file
test("Logs: valid 00-e health card single log file", () => {

    const logFile = 'log-00-e-single.txt';
    const expectedEntries = 1;
    const expectedLogItems = 8 + (OPENSSL_AVAILABLE ? 0 : 1);

    runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ${logFile} --valTime ${validationTime}`);

    const logs: LogEntry[] = testLogFile(logFile);

    expect(logs).toHaveLength(expectedEntries);
    expect(logs[0].log).toHaveLength(expectedLogItems);

});

test("Logs: valid 00-e health card append log file", () => {

    const logFile = 'log-00-e-append.txt';
    const expectedEntries = 2;
    const expectedLogItems = [8 + (OPENSSL_AVAILABLE ? 0 : 1), 8 + (OPENSSL_AVAILABLE ? 0 : 1)];

    runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ${logFile} --valTime ${validationTime}`);
    runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ${logFile} --valTime ${validationTime}`);

    const logs: LogEntry[] = testLogFile(logFile);

    expect(logs).toHaveLength(expectedEntries);
    expect(logs[0].log).toHaveLength(expectedLogItems[0]);
    expect(logs[1].log).toHaveLength(expectedLogItems[1]);
});

test("Logs: valid 00-e health card bad log path", () => {
    const logFile = '../foo/log.txt';
    const commandResult = runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info --logout ${logFile}`);
    expect(commandResult.exitCode).toBe(ec.LOG_PATH_NOT_FOUND);
});

test("Logs: valid 00-e health card fhir bundle log file", () => {
    const logFile = 'fhirout.json.log'; // .log to be gitignored
    runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info --fhirout ${logFile}`);
    // try parsing FHIR output log as a fhir bundle
    expect(testCliCommand(`node . --path ${logFile} --type fhirbundle`)).toBe(0);
    fs.rmSync(logFile, {force: true});
});

test("Logs: valid 00-e health card bad log path", () => {
    const logFile = '../foo/log.txt';
    const commandResult = runCommandSync(`node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info --logout ${logFile}`);
    expect(commandResult.exitCode).toBe(ec.LOG_PATH_NOT_FOUND);
});

// error exclusion
test("Cards: fhir bundle w/ trailing chars", () => expect(testCliCommand('node . --path testdata/test-example-00-a-fhirBundle-trailing_chars.json --type fhirbundle --jwkset testdata/issuer.jwks.public.json --exclude trailing-characters')).toBe(0));
test("Cards: fhir bundle w/ trailing chars", () => expect(testCliCommand('node . --path testdata/test-example-00-a-fhirBundle-trailing_chars.json --type fhirbundle --jwkset testdata/issuer.jwks.public.json --exclude trailing-*')).toBe(0)); // wildcard


// profiles
test("Cards: fhir bundle w/ usa-profile errors", () => expect(testCliCommand('node . --path testdata/example-00-a-fhirBundle.json --type fhirbundle --loglevel info --profile usa-covid19-immunization')).toBe(0));