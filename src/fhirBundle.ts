// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import fhirBundleSchema from '../schema/fhir-bundle-schema.json';
import Log from './logger';
import { ValidationResult } from './validate';
import beautify  from 'json-beautify'

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
            log: output.fatal("FhirBundle.entry[] required to continue.", ErrorCode.CRITICAL_DATA_MISSING)
        }
    }


    output.info("Fhir Bundle Contents:");
    output.info(beautify(fhirBundle, null as unknown as Array<string>, 3, 100));
    

    return { result: fhirBundle, log: output };
}


// payload .vc.credentialSubject.fhirBundle is created:
// without Resource.id elements
// without Resource.meta elements
// without Resource.text elements
// without CodeableConcept.text elements
// without Coding.display elements
// with Bundle.entry.fullUrl populated with short resource-scheme URIs (e.g., {"fullUrl": "resource:0})
// with Reference.reference populated with short resource-scheme URIs (e.g., {"patient": {"reference": "resource:0"}})