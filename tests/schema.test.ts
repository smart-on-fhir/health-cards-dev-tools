// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import { validateFromFile } from '../src/schema';


const schemaDir = './schema';
const exampleDir = './testdata';

// Map our schema files to the examples. The tests below can lookup 
// the appropriate schema with the 'lookup' function
const schemaMappings: { [key: string]: string[] } = {
    "keyset-schema": [
        'issuer.jwks.public.json'
    ],
    "fhir-bundle-schema": [
        'example-00-a-fhirBundle.json',
        'example-01-a-fhirBundle.json'
    ],
    "smart-health-card-schema": [
        'example-00-e-file.smart-health-card',
        'example-01-e-file.smart-health-card'
    ],
    "smart-health-card-vc-schema": [
        'example-00-b-jws-payload-expanded.json',
        'example-00-c-jws-payload-minified.json',
        'example-01-b-jws-payload-expanded.json',
        'example-01-c-jws-payload-minified.json',
    ],
    "jws-schema": [
        'example-00-d-jws.txt',
        'example-01-d-jws.txt'
    ]
};

const lookup = function (example: string): string {
    for (const schema in schemaMappings) {
        if (schemaMappings[schema].indexOf(example) >= 0) return schema;
    }
    throw new Error('Example not found : ' + example);
};

const examples: string[] = [
    'issuer.jwks.public.json',
    'example-00-a-fhirBundle.json',
    'example-00-b-jws-payload-expanded.json',
    'example-00-c-jws-payload-minified.json',
    'example-00-d-jws.txt',
    'example-00-e-file.smart-health-card',
    'example-01-a-fhirBundle.json',
    'example-01-b-jws-payload-expanded.json',
    'example-01-c-jws-payload-minified.json',
    'example-01-d-jws.txt',
    'example-01-e-file.smart-health-card'
];


examples.forEach(exampleName => {
    testSchema(exampleName);
});



function testSchema(exampleFile: string): void {
    // TODO: the next logical step would be to read each example file out of the examples directory
    //       and determine the appropriate schema and then build a test.
    //       this would require code that can determine schema by analysing the example.

    const schemaName = lookup(exampleFile);
    const schemaPath = path.resolve(schemaDir, schemaName + ".json");
    const examplePath = path.resolve(exampleDir, exampleFile);
    const fileData = fs.readFileSync(examplePath, 'utf-8');
    const ext = path.extname(examplePath);
    const dataObj = ext !== '.txt' ? JSON.parse(fileData) as FhirBundle | JWS | JWSPayload | HealthCard : fileData;

    test("Schema: " + schemaName + " " + exampleFile, async () => {
        const result = await validateFromFile(schemaPath, dataObj);
        expect(result.length).toBe(0);
    });

    return;
}