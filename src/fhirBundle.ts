// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import fhirBundleSchema from '../schema/fhir-bundle-schema.json';
import Log from './logger';
import { ValidationResult } from './validate';


export const schema = fhirBundleSchema;


export function validate(fhirBundleText: string): ValidationResult {

    const output = new Log('FhirBundle');


    const fhirBundle = utils.parseJson<FhirBundle>(fhirBundleText);
    if (fhirBundle === undefined) {
        return {
            result: fhirBundle,
            log: output.fatal("Failed to parse FhirBundle data as JSON.", ErrorCode.JSON_PARSE_ERROR)
        }
    }


    // failures will be recorded in the log. we can continue processing.
    validateSchema(fhirBundleSchema, fhirBundle, output);


    // to continue validation, we must have a jws-compact string to validate
    if (!fhirBundle.entry ||
        !(fhirBundle.entry instanceof Array) ||
        fhirBundle.entry.length === 0
    ) {
        // The schema check above will list the expected properties/type
        return {
            result: fhirBundle,
            log: output.fatal("FhirBundle.entry[] required to contine.", ErrorCode.CRITICAL_DATA_MISSING)
        }
    }


    output.info("Fhir Bundle Contents:");
    output.info(JSON.stringify(fhirBundle, null, 2));
    

    return { result: fhirBundle, log: output };
}
