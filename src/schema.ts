// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import { ErrorCode } from './error';
import fhirSchema from '../schema/fhir-schema.json';
import Ajv, { AnySchemaObject } from "ajv";
import { AnyValidateFunction } from 'ajv/dist/core';
import { KeySet } from './keys';


const schemaCache: Record<string, AnyValidateFunction> = {};


export function validateSchema(schema: AnySchemaObject, data: FhirBundle | JWS | JWSPayload | HealthCard | KeySet | Resource, log: Log): boolean {

    // by default, the validator will stop at the first failure. 'allErrors' allows it to keep going.
    const schemaId = (schema as { [key: string]: string })["$id"] || (schema as { [key: string]: string })["$ref"];

    try {

        if (!schemaCache[schemaId]) {
            const ajv = new Ajv({ strict: false, allErrors: false });
            if(schema.$ref) {
                schemaCache[schemaId] = ajv.addSchema(fhirSchema).compile(schema);
            } else {
                schemaCache[schemaId] = ajv.compile(schema);
            }
        }

        const validate = schemaCache[schemaId];

        if (validate(data)) {
            return true;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let errors = validate.errors!
            .map((err) => JSON.stringify(err));

        // remove the duplicates (can be many if property part of oneOf[])
        errors = errors
            .filter((err, index) => errors.indexOf(err) === index);

        errors.forEach(ve => {
            log.error('Schema: ' + ve, ErrorCode.SCHEMA_ERROR);
        });

        return false;

    } catch (err) {
        // TODO: get to this catch in test
        log.error('Schema: ' + (err as Error).message, ErrorCode.SCHEMA_ERROR);
        return false;
    }
}


// from a path, follow the schema to figure out a 'type'
export function objPathToSchema(path: string) : string {

    const schema: Schema = fhirSchema;
    const properties = path.split('.');

    let p = schema.definitions[properties[0]];
    let t = properties[0];

    for (let i = 1; i < properties.length; i++) {

        if (p.properties) {
            p = p.properties[properties[i]];

            // directly has a ref, then it is that type
            if (p.$ref) {
                t = p.$ref.slice(p.$ref.lastIndexOf('/') + 1);
                p = schema.definitions[t];
                continue;
            }

            // has and items prop of ref, then it is an array of that type
            if (p.items && '$ref' in p.items) {
                t = p.items.$ref.slice(p.items.$ref.lastIndexOf('/') + 1);
                p = schema.definitions[t];
                continue;
            }

            // has and items prop of ref, then it is an array of that type
            if (p.enum) {
                t = "enum";
                continue;
            }
        }

        if (p.const) {
            t = 'const';
            continue;
        }

        if (p.type) {
            t = p.type;
            continue;
        }

        throw new Error('Should not get here.');
    }

    return t;

}