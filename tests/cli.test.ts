// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import execa from 'execa';
import fs from 'fs';
import { ErrorCode } from '../src/error';
import { LogItem } from '../src/logger';
import { CliOptions } from '../src/shc-validator';


interface LogEntry {
    time: string,
    options: CliOptions,
    log: LogItem[]
}


function runCommand(command: string) {
    try {
        return execa.commandSync(command);

    } catch (error) {
        // if exitCode !== 0 this error will be thrown
        // this error object is similar to the result object that would be returned if successful. 
        // we'll return it an sort out the errors there.
        return error as execa.ExecaSyncError;
    }
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
    const commandResult = runCommand(command);
    const out = parseStdout(commandResult.stdout);
    console.log(out.join('\n'));
    return commandResult.exitCode;
}

// Valid calls to examples
test("Cards: valid 00 health card", () => expect(testCliCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info --jwkset testdata/issuer.jwks.public.json')).toBe(0));
test("Cards: valid 00 jws", () => expect(testCliCommand('node . --path testdata/example-00-d-jws.txt --type jws --loglevel info')).toBe(0));
test("Cards: valid 00 jws-payload", () => expect(testCliCommand('node . --path testdata/example-00-c-jws-payload-minified.json --type jwspayload --loglevel info')).toBe(0));
test("Cards: valid 00 fhirBundle", () => expect(testCliCommand('node . --path testdata/example-00-a-fhirBundle.json --type fhirbundle --loglevel info')).toBe(0));
test("Cards: valid 00 qr-code-numeric", () => expect(testCliCommand('node . --path testdata/example-00-f-qr-code-numeric-value-0.txt --type qrnumeric --loglevel info')).toBe(0));
test("Cards: valid 00 qr-code.svg", () => expect(testCliCommand('node . --path testdata/example-00-g-qr-code-0.svg --type qr --loglevel info')).toBe(0));

test("Cards: valid 01 health card", () => expect(testCliCommand('node . --path testdata/example-01-e-file.smart-health-card --type healthcard --loglevel warning')).toBe(0));
test("Cards: valid 01 jws", () => expect(testCliCommand('node . --path testdata/example-01-d-jws.txt --type jws --loglevel warning')).toBe(0));
test("Cards: valid 01 jws-payload", () => expect(testCliCommand('node . --path testdata/example-01-c-jws-payload-minified.json --type jwspayload --loglevel warning')).toBe(0));
test("Cards: valid 01 fhirBundle", () => expect(testCliCommand('node . --path testdata/example-01-a-fhirBundle.json --type fhirbundle --loglevel warning')).toBe(0));
test("Cards: valid 01 qr-code-numeric", () => expect(testCliCommand('node . --path testdata/example-01-f-qr-code-numeric-value-0.txt --type qrnumeric --loglevel info')).toBe(0));
test("Cards: valid 01 qr-code.svg", () => expect(testCliCommand('node . --path testdata/example-01-g-qr-code-0.svg --type qr --loglevel info')).toBe(0));

test("Cards: valid 02 health card", () => expect(testCliCommand('node . --path testdata/example-02-e-file.smart-health-card --type healthcard --loglevel warning')).toBe(0));
test("Cards: valid 02 jws", () => expect(testCliCommand('node . --path testdata/example-02-d-jws.txt --type jws --loglevel warning')).toBe(0));
test("Cards: valid 02 jws-payload", () => expect(testCliCommand('node . --path testdata/example-02-c-jws-payload-minified.json --type jwspayload --loglevel warning')).toBe(0));
test("Cards: valid 02 fhirBundle", () => expect(testCliCommand('node . --path testdata/example-02-a-fhirBundle.json --type fhirbundle --loglevel warning')).toBe(0));
test("Cards: valid 02 qr-code-numeric", () => expect(testCliCommand('node . --path testdata/example-02-f-qr-code-numeric-value-0.txt --path testdata/example-02-f-qr-code-numeric-value-1.txt --path testdata/example-02-f-qr-code-numeric-value-2.txt --type qrnumeric --loglevel info')).toBe(0));
test("Cards: valid 02 qr-code.svg", () => expect(testCliCommand('node . --path testdata/example-02-g-qr-code-0.svg --path testdata/example-02-g-qr-code-1.svg --path testdata/example-02-g-qr-code-2.svg --type qr --loglevel info')).toBe(0));
test("Cards: valid 02 qr-code.png", () => expect(testCliCommand('node . --path testdata/example-02-g-qr-code-0.png --path testdata/example-02-g-qr-code-1.png --path testdata/example-02-g-qr-code-2.png --type qr --loglevel info')).toBe(0));
test("Cards: valid 02 qr-code.jpg", () => expect(testCliCommand('node . --path testdata/example-02-g-qr-code-0.jpg --path testdata/example-02-g-qr-code-1.jpg --path testdata/example-02-g-qr-code-2.jpg --type qr --loglevel info')).toBe(0));
test("Cards: valid 02 qr-code.bmp", () => expect(testCliCommand('node . --path testdata/example-02-g-qr-code-0.bmp --path testdata/example-02-g-qr-code-1.bmp --path testdata/example-02-g-qr-code-2.bmp --type qr --loglevel info')).toBe(0));

// valid key example
test("Cards: valid key set", () => expect(testCliCommand('node . --path testdata/issuer.jwks.public.json --type jwkset --loglevel info')).toBe(0));

// Bad paths to data files
test("Cards: missing healthcard", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type healthcard --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing jws", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jws --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing jwspayload", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jwspayload --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing fhirbundle", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type fhirbundle --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing qrnumeric", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qrnumeric --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing qr", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qr --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));

// Log file
test("Logs: valid 00-e health card single log file", () => {

    const logFile = 'log-00-e-single.txt';
    const expectedEntries = 1;
    const expectedLogItems = 7;

    runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ' + logFile);

    const logs: LogEntry[] = testLogFile(logFile);

    expect(logs).toHaveLength(expectedEntries);
    expect(logs[0].log).toHaveLength(expectedLogItems);

});

test("Logs: valid 00-e health card append log file", () => {

    const logFile = 'log-00-e-append.txt';
    const expectedEntries = 2;
    const expectedLogItems = [7, 7];

    runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ' + logFile);
    runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ' + logFile);

    const logs: LogEntry[] = testLogFile(logFile);

    expect(logs).toHaveLength(expectedEntries);
    expect(logs[0].log).toHaveLength(expectedLogItems[0]);
    expect(logs[1].log).toHaveLength(expectedLogItems[1]);

});

test("Logs: valid 00-e health card bad log path", () => {
    const logFile = '../foo/log.txt';
    const commandResult = runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --logout ' + logFile);
    expect(commandResult.exitCode).toBe(ErrorCode.LOG_PATH_NOT_FOUND);
});

test("Logs: valid 00-e health card fhir bundle log file", () => {
    const logFile = 'fhirout.json.log'; // .log to be gitignored
    const commandResult = runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --fhirout ' + logFile);
    // try parsing FHIR output log as a fhir bundle
    expect(testCliCommand(`node . --path ${logFile} --type fhirbundle`)).toBe(0);
});

test("Logs: valid 00-e health card bad log path", () => {
    const logFile = '../foo/log.txt';
    const commandResult = runCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info  --fhirout ' + logFile);
    expect(commandResult.exitCode).toBe(ErrorCode.LOG_PATH_NOT_FOUND);
});
