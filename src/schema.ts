// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import Log from './logger';
import { ErrorCode } from './error';
import metaSchema from 'ajv/lib/refs/json-schema-draft-06.json';
import fhirSchema from '../schema/fhir-definitions-schema.json';
import Ajv, { AnySchemaObject } from "ajv";
// http://json-schema.org/
// https://github.com/ajv-validator/ajv


export function validateSchema(schema: AnySchemaObject | AnySchemaObject[], data: FhirBundle | JWS | JWSPayload | HealthCard, log: Log): boolean {

    // by default, the validator will stop at the first failure. 'allErrors' allows it to keep going.
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajv.addMetaSchema(metaSchema);  // required for avj 7 to support json-schema draft-06 (draft-07 is current)

    try {

        // TODO: make this fail in test
        const validate = ajv.addSchema(fhirSchema).compile(schema);

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
