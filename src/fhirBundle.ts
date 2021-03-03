// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import {validateSchema} from './schema';
import { OutputTree, ErrorCode } from './error';
import fhirBundleSchema from '../schema/fhir-bundle-schema.json';


export const schema = fhirBundleSchema;

export function validate(fhirBundleText: string): OutputTree {

    const output = new OutputTree('FhirBundle');


    const fhirBundle = utils.parseJson<FhirBundle>(fhirBundleText);
    if (fhirBundle === undefined) {
        return output
            .fatal("Failed to parse FhirBundle data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }


    // returns [] if successful
    const schemaResults = validateSchema(fhirBundleSchema, fhirBundle);
    output.add(schemaResults);


    // to continue validation, we must have a jws-compact string to validate
    if (!fhirBundle.entry ||
        !(fhirBundle.entry instanceof Array) ||
        fhirBundle.entry.length === 0
    ) {
        // The schema check above will list the expected properties/type
        return output.error("FhirBundle.entry[] required to contine.");
    }

    output.info("Fhir Bundle Contents:");
    output.info(JSON.stringify(fhirBundle, null, 2));
    
    return output;
}