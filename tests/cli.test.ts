// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import execa from 'execa';
import { ErrorCode } from '../src/error';

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

function testCliCommand(command: string): number {
    const commandResult = runCommand(command);
    const out = parseStdout(commandResult.stdout);
    console.log(out.join('\n'));
    return commandResult.exitCode;
}

// Valid calls to examples
test("Cards: valid 00 health card", () => expect(testCliCommand('node . --path testdata/example-00-e-file.smart-health-card --type healthcard --loglevel info')).toBe(0));
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
test("Cards: valid 02 qr-code.svg", () => expect(testCliCommand('node . --path testdata/example-02-g-qr-code-0.svg --path testdata/example-02-g-qr-code-0.svg --path testdata/example-02-g-qr-code-0.svg --type qr --loglevel info')).toBe(0));

test("Cards: valid qr.png", () => expect(testCliCommand('node . --path testdata/qr.png --type qr --loglevel info')).toBe(0));
test("Cards: valid qr-90.pngd", () => expect(testCliCommand('node . --path testdata/qr-90.png --type qr --loglevel info')).toBe(0));

// Bad paths to data files
test("Cards: missing healthcard", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type healthcard --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing jws", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jws --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing jwspayload", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type jwspayload --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing fhirbundle", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type fhirbundle --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing qrnumeric", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qrnumeric --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));
test("Cards: missing qr", () => expect(testCliCommand('node . --path bogus-path/bogus-file.json --type qr --loglevel info')).toBe(ErrorCode.DATA_FILE_NOT_FOUND));

