// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import log, { LogLevels } from './logger';
import { ErrorCode, LogItem } from './error';

// http://json-schema.org/
// https://github.com/ajv-validator/ajv
import JsonValidator, { AnySchemaObject, ErrorObject } from "ajv";


export async function validateFromFile(schemaPath: string, data: FhirBundle | JWS | JWSPayload | HealthCard): Promise<LogItem[]> {

    if (!fs.existsSync(schemaPath)) {
        log('Schema file not found : ' + schemaPath, LogLevels.FATAL);
        return [new LogItem('Schema: file not found : ' + schemaPath, ErrorCode.SCHEMA_FILE_NOT_FOUND)];
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

            if (validate(data)) {
                return [];
            } else {
                const errors = (validate.errors as ErrorObject[]);

                const outErrors = errors.map(c => {
                    return new LogItem(
                        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                        'Schema: ' + c.schemaPath + '  \'' + c.message + '\'',
                        ErrorCode.SCHEMA_ERROR);
                });
                return outErrors;
            }
        })
        .catch(error => {
            return [new LogItem(
                "Error: validating against schema : " + (error as Error).message,
                ErrorCode.SCHEMA_ERROR)];
        });

}


export function validateSchema(schema: AnySchemaObject, data: FhirBundle | JWS | JWSPayload | HealthCard): LogItem[] {

    const jsonValidator = new JsonValidator({ allErrors: true });

    try {
        const validate = jsonValidator.compile(schema);

        if (validate(data)) { return []; }

        const validationErrors = (validate.errors as ErrorObject[]);

        const outErrors = validationErrors.map(ve => {
            return new LogItem(
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                'Schema: ' + ve.schemaPath + '  \'' + ve.message + '\'',
                ErrorCode.SCHEMA_ERROR, LogLevels.ERROR);
        });

        return outErrors;

    } catch (err) {
        return [new LogItem('Schema: ' + (err as Error).message, ErrorCode.SCHEMA_ERROR)];
    }
}