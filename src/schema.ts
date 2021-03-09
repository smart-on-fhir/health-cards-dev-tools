// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import Log from './logger';
import { ErrorCode } from './error';
import metaSchema from 'ajv/lib/refs/json-schema-draft-06.json';
import fhirSchema from '../schema/fhir-definitions-schema.json';
import Ajv, { AnySchemaObject } from "ajv";
import { AnyValidateFunction } from 'ajv/dist/core';
// http://json-schema.org/
// https://github.com/ajv-validator/ajv



const schemaCache: Record<string, AnyValidateFunction> = {};


export function validateSchema(schema: AnySchemaObject | AnySchemaObject[], data: FhirBundle | JWS | JWSPayload | HealthCard, log: Log): boolean {

    // by default, the validator will stop at the first failure. 'allErrors' allows it to keep going.
    const schemaId = (schema as { [key: string]: string })["$id"];

    try {

        if (!schemaCache[schemaId]) {
            const ajv = new Ajv({ allErrors: true, strict: false });
            ajv.addMetaSchema(metaSchema);  // required for avj 7 to support json-schema draft-06 (draft-07 is current)
            const validate = ajv.addSchema(fhirSchema).compile(schema);
            schemaCache[schemaId] = validate;
        }

        const validate = schemaCache[schemaId];

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
