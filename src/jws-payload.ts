// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import jwsPayloadSchema from '../schema/smart-health-card-vc-schema.json';
import * as fhirBundle from './fhirBundle';
import Log from './logger';
import beautify from 'json-beautify'

export const schema = jwsPayloadSchema;


export function validate(jwsPayloadText: string): Log {

    const log = new Log('JWS.payload');

    if (jwsPayloadText.trim() !== jwsPayloadText) {
        log.warn(`JWS payload has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        jwsPayloadText = jwsPayloadText.trim();
    }

    const jwsPayload = utils.parseJson<JWSPayload>(jwsPayloadText);
    if (!jwsPayload || typeof jwsPayload !== 'object') {
        return log.fatal("Failed to parse JWS.payload data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }
    log.debug("JWS Payload Contents:");
    log.debug(beautify(jwsPayload, null as unknown as Array<string>, 3, 100));

    // failures will be recorded in the log. we can continue processing.
    validateSchema(jwsPayloadSchema, jwsPayload, log);

    // validate issuance date, if available - the schema check above will flag if missing/invalid
    if (utils.isNumeric(jwsPayload.nbf)) {
        const nbf = new Date();
        nbf.setTime(jwsPayload.nbf * 1000); // convert seconds to milliseconds
        const now = new Date();
        if (nbf > now) {
            if (jwsPayload.nbf > new Date(2021, 1, 1).getTime()) {
                // we will assume the nbf was encoded in milliseconds, and we will return an error
                const dateParsedInMilliseconds = new Date();
                dateParsedInMilliseconds.setTime(jwsPayload.nbf);
                log.error(`Health card is not yet valid, nbf=${jwsPayload.nbf} (${nbf.toUTCString()}).\n` +
                    "nbf should be encoded in seconds since 1970-01-01T00:00:00Z UTC.\n" +
                    `Did you encode the date in milliseconds, which would give the date: ${dateParsedInMilliseconds.toUTCString()}?`,
                    ErrorCode.NOT_YET_VALID);
            } else {
                log.warn(`Health card is not yet valid, nbf=${jwsPayload.nbf} (${nbf.toUTCString()}).`, ErrorCode.NOT_YET_VALID);
            }
        }
    }

    if (jwsPayload.vc && Object.keys(jwsPayload.vc).includes("@context")) {
        log.warn("JWS.payload.vc shouldn't have a @context property", ErrorCode.SCHEMA_ERROR);
    }

    if (!jwsPayload?.vc?.type?.includes('https://smarthealth.cards#health-card')) {
        log.warn("JWS.payload.vc.type should contain 'https://smarthealth.cards#health-card'", ErrorCode.SCHEMA_ERROR);
    }

    // to continue validation, we must have a FHIR bundle string to validate
    if (!jwsPayload?.vc?.credentialSubject?.fhirBundle) {
        // The schema check above will list the expected properties/type
        return log.fatal("JWS.payload.vc.credentialSubject.fhirBundle{} required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }

    log.info("JWS Payload validated");

    const fhirBundleText = JSON.stringify(jwsPayload.vc.credentialSubject.fhirBundle);

    log.child.push((fhirBundle.validate(fhirBundleText)));


    return log;
}
