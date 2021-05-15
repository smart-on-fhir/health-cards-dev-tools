// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import { ErrorCode } from './error';
import fhirSchema from '../schema/fhir-schema.json';
import Ajv, { AnySchemaObject } from "ajv";
import { AnyValidateFunction } from 'ajv/dist/core';
import { KeySet } from './keys';


const schemaCache: Record<string, AnyValidateFunction> = {};


export function validateSchema(schema: AnySchemaObject, data: FhirBundle | JWS | JWSPayload | HealthCard | KeySet | Resource, log: Log, pathPrefix = ''): boolean {

    // by default, the validator will stop at the first failure. 'allErrors' allows it to keep going.
    const schemaId = (schema as { [key: string]: string })["$id"] || (schema as { [key: string]: string })["$ref"];
    const isFhirSchema = schemaId.startsWith(fhirSchema.$id);

    try {

        if (!schemaCache[schemaId]) {
            const ajv = new Ajv({ strict: false, allErrors: true });
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
            //"dataPath":"/meta/security/0"

            // prefix 'dataPath' property with passed in pathPrefix
            // because when validating sub-schemas our paths are relative and it may
            // not be apparent what the full path is when referring to common properties like 'id'
            const pathPart = ve.indexOf('"dataPath":"');

            if (pathPart > 0 && pathPrefix.length > 0) {
                const insertIndex = pathPart + '"dataPath":"'.length;
                ve = ve.slice(0, insertIndex) + pathPrefix + ve.slice(insertIndex);
            }

            log.error('Schema: ' + ve, isFhirSchema ? ErrorCode.FHIR_SCHEMA_ERROR : ErrorCode.SCHEMA_ERROR);
        });

        return false;

    } catch (err) {
        // TODO: get to this catch in test
        log.error('Schema: ' + (err as Error).message, isFhirSchema ? ErrorCode.FHIR_SCHEMA_ERROR : ErrorCode.SCHEMA_ERROR);
        return false;
    }
}


// from a path, follow the schema to figure out a 'type'
export function objPathToSchema(path: string) : string {

    const schema: Schema = fhirSchema;
    const properties = path.split('.');

    let p = schema.definitions[properties[0]];
    if(p == null) return 'unknown';


    let t = properties[0];

    for (let i = 1; i < properties.length; i++) {

        if (p.properties) {

            p = p.properties[properties[i]];

            // this property is not valid according to the schema
            if (p == null) {
                t = "unknown";
                break;
            }

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