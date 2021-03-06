// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import Log from './logger';
import { ErrorCode } from './error';


// http://json-schema.org/
// https://github.com/ajv-validator/ajv
import JsonValidator, { AnySchemaObject } from "ajv";


export async function validateFromFile(schemaPath: string, data: FhirBundle | JWS | JWSPayload | HealthCard, log: Log): Promise<boolean> {

    if (!fs.existsSync(schemaPath)) {
        log.fatal('Schema file not found : ' + schemaPath, ErrorCode.SCHEMA_ERROR);
        return false;
    }

    const schemaDir = path.basename(path.dirname(schemaPath));

    // for each $ref in our schema, load the schema file into an object and return it.
    const jsonValidator = new JsonValidator({
        allErrors: true,
        loadSchema: (uri) => {
            const schemaFile: string = uri.slice(uri.lastIndexOf('/'));
            const schemaFullPath = path.join(schemaDir, schemaFile);
            const schema = JSON.parse(fs.readFileSync(schemaFullPath, 'utf8')) as AnySchemaObject;
            return Promise.resolve(schema);
        }
    });

    const schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as AnySchemaObject;

    return jsonValidator.compileAsync(schemaObj)
        .then(validate => {
            if (validate(data)) { return true; }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            validate.errors!.forEach(ve => {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                log.error('Schema: ' + ve.schemaPath + '  \'' + ve.message + '\'', ErrorCode.SCHEMA_ERROR);
            });
            return false;
        })
        .catch(err => {
            // TODO: get to this catch in test
            log.error('Schema: ' + (err as Error).message, ErrorCode.SCHEMA_ERROR);
            return false;
        });

}


export function validateSchema(schema: AnySchemaObject, data: FhirBundle | JWS | JWSPayload | HealthCard, log: Log): boolean {

    // by default, the validator will stop at the first failure. 'allErrors' allows it to keep going.
    const jsonValidator = new JsonValidator({ allErrors: true });

    try {

        // TODO: make this fail in test
        const validate = jsonValidator.compile(schema);

        if (validate(data)) { return true; }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        validate.errors!.forEach(ve => {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            log.error('Schema: ' + ve.schemaPath + '  \'' + ve.message + '\'', ErrorCode.SCHEMA_ERROR);
        });

        return false;

    } catch (err) {
        // TODO: get to this catch in test
        log.error('Schema: ' + (err as Error).message, ErrorCode.SCHEMA_ERROR);
        return false;
    }
}
