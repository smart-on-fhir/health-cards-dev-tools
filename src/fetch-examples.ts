// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: handle new example-02-* test set

import fs from 'fs';
import path from 'path';
import stream from 'stream';
import {promisify} from 'util';
import {JWK} from 'node-jose';
import got from 'got';


const outPath = 'testdata';
const baseExampleUrl = 'https://smarthealth.cards/examples/';
const exampleCount = 2;
const examplePrefix = 'example-';
const exampleSuffixes = [
    '-a-fhirBundle.json',
    '-b-jws-payload-expanded.json',
    '-c-jws-payload-minified.json',
    '-d-jws.txt',
    '-e-file.smart-health-card',
    '-f-qr-code-numeric-value-0.txt',
    '-g-qr-code-0.svg'
];

const pipeline = promisify(stream.pipeline);

async function fetchExamples(outdir: string) : Promise<void> {
    
    const getExamples = exampleSuffixes.map(async (exampleSuffix) => {

        for(let i = 0; i < exampleCount; i++) {

            const exampleNumber = i.toLocaleString('en-US', {
                minimumIntegerDigits: 2,
                useGrouping: false,
            });    
            
            const exampleFile = examplePrefix + exampleNumber + exampleSuffix;
            const filePath = path.join(outdir, exampleFile);

            if (!fs.existsSync(filePath)) {
                const exampleUrl = baseExampleUrl + exampleFile;
                console.log('Retrieving ' + exampleUrl);
                try {
                    await pipeline(
                        got.stream(exampleUrl),
                        fs.createWriteStream(filePath)
                    );
                } catch (err) {
                    console.log('Error retrieving: ' + exampleUrl, (err as Error).message);
                }
            }
        }
    });
  
    await Promise.all(getExamples);
}

const issuerPrivateKeyUrl = 'https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/generate-examples/src/config/issuer.jwks.private.json';
const issuerPublicKeyFileName = 'issuer.jwks.public.json';

async function fetchKeys(outdir: string) : Promise<void> {

    const filePath = path.join(outdir, issuerPublicKeyFileName);

    if (!fs.existsSync(filePath)) {
        // download the private key set, save as string
        console.log('Retrieving ' + issuerPrivateKeyUrl);
        const issuerPrivateKeySet  = JSON.stringify(await got(issuerPrivateKeyUrl).json());

        // parse the private key set, export back as public
        const isPrivateKey = false;
        const issuerPublicKeySet = (await JWK.asKeyStore(issuerPrivateKeySet)).toJSON(isPrivateKey);
        fs.writeFileSync(filePath, JSON.stringify(issuerPublicKeySet));
    }
}

// We have to wrap these calls in an async function for ES5 support
// Typescript error: Top-level 'await' expressions are only allowed when the 'module' option is set to 'esnext'
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await fetchExamples(outPath);
    await fetchKeys(outPath);
})();
