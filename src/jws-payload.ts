// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import jwsPayloadSchema from '../schema/smart-health-card-vc-schema.json';
import * as fhirBundle from './fhirBundle';
import Log from './logger';
import { ValidationResult } from './validate';
import beautify from 'json-beautify'

export const schema = jwsPayloadSchema;


export function validate(jwsPayloadText: string): ValidationResult {

    const log = new Log('JWS.payload');

    if (jwsPayloadText.trim() !== jwsPayloadText) {
        log.warn(`JWS payload has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        jwsPayloadText = jwsPayloadText.trim();
    }

    const jwsPayload = utils.parseJson<JWSPayload>(jwsPayloadText);
    if (jwsPayload === undefined) {
        return {
            result: jwsPayload,
            log: log.fatal("Failed to parse JWS.payload data as JSON.", ErrorCode.JSON_PARSE_ERROR)
        }
    }
    log.debug("JWS Payload Contents:");
    log.debug(beautify(jwsPayload, null as unknown as Array<string>, 3, 100));
    
    // failures will be recorded in the log. we can continue processing.
    validateSchema(jwsPayloadSchema, jwsPayload, log);


    // to continue validation, we must have a FHIR bundle string to validate
    if (
        !jwsPayload.vc ||
        !jwsPayload.vc.credentialSubject ||
        !jwsPayload.vc.credentialSubject.fhirBundle
    ) {
        // The schema check above will list the expected properties/type
        return {
            result: jwsPayload,
            log: log.fatal("JWS.payload.vc.credentialSubject.fhirBundle{} required to continue.", ErrorCode.CRITICAL_DATA_MISSING)
        }
    }

    log.info("JWS Payload validated");

    const fhirBundleText = JSON.stringify(jwsPayload.vc.credentialSubject.fhirBundle);

    log.child = (fhirBundle.validate(fhirBundleText)).log;


    return { result: jwsPayload, log: log };
}
