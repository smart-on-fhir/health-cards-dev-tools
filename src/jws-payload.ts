// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { OutputTree, ErrorCode } from './error';
import jwsPayloadSchema from '../schema/smart-health-card-vc-schema.json';
import * as fhirBundle from './fhirBundle';


export const schema = jwsPayloadSchema;

export function validate(jwsPayloadText: string): OutputTree {

    const output = new OutputTree('JWS.payload');


    const jwsPayload = utils.parseJson<JWSPayload>(jwsPayloadText);
    if (jwsPayload === undefined) {
        return output
            .fatal("Failed to parse JWS.payload data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    // this will get passed back to the jws-compact validation so it can
    // pull out the url for the key
    output.result = jwsPayload;

    // returns [] if successful
    const schemaResults = validateSchema(jwsPayloadSchema, jwsPayload);
    output.add(schemaResults);


    // to continue validation, we must have a jws-compact string to validate
    if (
        !jwsPayload.vc ||
        !jwsPayload.vc.credentialSubject ||
        !jwsPayload.vc.credentialSubject.fhirBundle
    ) {
        // The schema check above will list the expected properties/type
        return output.fatal("JWS.payload.vc.credentialSubject.fhirBundle{} required to contine.",
            ErrorCode.CRITICAL_DATA_MISSING);
    }

    const fhirBundleText = JSON.stringify(jwsPayload.vc.credentialSubject.fhirBundle);

    output.child = fhirBundle.validate(fhirBundleText);

    return output;
}