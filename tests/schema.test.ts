// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AnySchemaObject } from 'ajv';
import fs from 'fs';
import path from 'path';
import Log from '../src/logger';
import { validateSchema } from '../src/schema';


const schemaDir = './schema';
const exampleDir = './testdata';


// Map our schema files to the examples. The tests below can lookup 
// the appropriate schema with the 'lookup' function
const schemaMappings: { [key: string]: string[] } = {
    "keyset-schema": [
        'issuer.jwks.public.json'
    ],
    "fhir-schema": [
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


const log = new Log('Schema Tests');


function testSchema(exampleFile: string): boolean  {

    const schemaName = lookup(exampleFile);
    const schemaPath = path.resolve(schemaDir, schemaName + ".json");
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as AnySchemaObject;

    const examplePath = path.resolve(exampleDir, exampleFile);
    const fileData = fs.readFileSync(examplePath, 'utf-8');
    const ext = path.extname(examplePath);
    const dataObj = ext !== '.txt' ? JSON.parse(fileData) as FhirBundle | JWS | JWSPayload | HealthCard : fileData;

    const result = validateSchema(schema, dataObj, log);

    expect(result).toBe(true);

    return result;
}


test("Schema: valid 00-a-fhirBundle", () => { testSchema('example-00-a-fhirBundle.json'); });
test("Schema: valid 00-b-jws-payload-expanded", () => { testSchema('example-00-b-jws-payload-expanded.json'); });
test("Schema: valid 00-c-jws-payload-minified", () => { testSchema('example-00-c-jws-payload-minified.json'); });
test("Schema: valid 00-d-jws", () => { testSchema('example-00-d-jws.txt'); });
test("Schema: valid 00-e-file.smart-health-card", () => { testSchema('example-00-e-file.smart-health-card'); });

test("Schema: valid issuer.jwks.public", () => { testSchema('issuer.jwks.public.json'); });

test("Schema: valid 01-a-fhirBundle", () => { testSchema('example-01-a-fhirBundle.json'); });
test("Schema: valid 01-b-jws-payload-expanded", () => { testSchema('example-01-b-jws-payload-expanded.json'); });
test("Schema: valid 01-c-jws-payload-minified", () => { testSchema('example-01-c-jws-payload-minified.json'); });
test("Schema: valid 01-d-jws", () => { testSchema('example-01-d-jws.txt'); });
test("Schema: valid 01-e-file.smart-health-card", () => { testSchema('example-01-e-file.smart-health-card'); });
