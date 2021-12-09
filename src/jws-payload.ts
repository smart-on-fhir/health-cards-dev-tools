// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import jwsPayloadSchema from '../schema/smart-health-card-vc-schema.json';
import * as fhirBundle from './fhirBundle';
import Log from './logger';
import beautify from 'json-beautify'
import { cdcCovidCvxCodes, loincCovidTestCodes } from './fhirBundle';

export const schema = jwsPayloadSchema;


export async function validate(jwsPayloadText: string): Promise<Log> {

    const log = new Log('JWS.payload');

    const supportedTypes = {
        healthCard: 'https://smarthealth.cards#health-card',
        immunization: 'https://smarthealth.cards#immunization',
        laboratory: 'https://smarthealth.cards#laboratory',
        covid19: 'https://smarthealth.cards#covid19',
        vc: 'VerifiableCredential'
    };

    if (jwsPayloadText.trim() !== jwsPayloadText) {
        log.error(`JWS payload has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
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

    if (!jwsPayload?.vc?.type?.includes(supportedTypes.healthCard)) {
        log.error(`JWS.payload.vc.type SHALL contain '${supportedTypes.healthCard}'`, ErrorCode.SCHEMA_ERROR);
    }

    // to continue validation, we must have a FHIR bundle string to validate
    if (!jwsPayload?.vc?.credentialSubject?.fhirBundle) {
        // The schema check above will list the expected properties/type
        return log.fatal("JWS.payload.vc.credentialSubject.fhirBundle{} required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }

    log.info("JWS Payload validated");

    const fhirBundleJson = jwsPayload.vc.credentialSubject.fhirBundle;
    const fhirBundleText = JSON.stringify(fhirBundleJson);
    log.child.push((await fhirBundle.validate(fhirBundleText)));

    // does the FHIR bundle contain an immunization?
    const hasImmunization = fhirBundleJson?.entry?.some(entry => entry?.resource?.resourceType === 'Immunization');

    // does the FHIR bundle contain a covid immunization?
    const hasCovidImmunization = fhirBundleJson?.entry?.some(entry =>
        entry.resource.resourceType === 'Immunization' &&
        (cdcCovidCvxCodes.includes((entry?.resource?.vaccineCode as { coding: { code: string }[] })?.coding?.[0]?.code)));

    // does the FHIR bundle contain a covid lab observation?
    // TODO: support more general labs
    // http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/StructureDefinition-covid19-laboratory-result-observation.html
    const hasCovidObservation = fhirBundleJson?.entry?.some(entry =>
        entry.resource.resourceType === 'Observation' &&
        (loincCovidTestCodes.includes((entry?.resource?.code as { coding: { code: string }[] })?.coding?.[0]?.code)));

    // check for health card VC types (https://spec.smarthealth.cards/vocabulary/)
    const hasImmunizationType = jwsPayload?.vc?.type?.includes(supportedTypes.immunization);
    const hasLaboratoryType = jwsPayload?.vc?.type?.includes(supportedTypes.laboratory);
    const hasCovidType = jwsPayload?.vc?.type?.includes(supportedTypes.covid19);
    const hasVerifiableCredential = jwsPayload?.vc?.type?.includes(supportedTypes.vc);

    if (hasImmunization && !hasImmunizationType) {
        log.warn(`JWS.payload.vc.type SHOULD contain '${supportedTypes.immunization}'`, ErrorCode.SCHEMA_ERROR);
    } else if (!hasImmunization && hasImmunizationType) {
        log.warn(`JWS.payload.vc.type SHOULD NOT contain '${supportedTypes.immunization}', no immunization resources found`, ErrorCode.SCHEMA_ERROR);
    }

    if (hasCovidObservation && !hasLaboratoryType) {
        log.warn(`JWS.payload.vc.type SHOULD contain '${supportedTypes.laboratory}'`, ErrorCode.SCHEMA_ERROR);
    }

    if ((hasCovidImmunization || hasCovidObservation) && !hasCovidType) {
        log.warn(`JWS.payload.vc.type SHOULD contain '${supportedTypes.covid19}'`, ErrorCode.SCHEMA_ERROR);
    } else if (!(hasCovidImmunization || hasCovidObservation) && hasCovidType) {
        log.warn(`JWS.payload.vc.type SHOULD NOT contain '${supportedTypes.covid19}', no covid immunization or observation found (only CVX codes are currently recognized by the tool)`, ErrorCode.SCHEMA_ERROR);
    }

    if (hasVerifiableCredential) {
        log.warn(`JWS.payload.vc.type : '${supportedTypes.vc}' is not required and may be omitted to conserve space`, ErrorCode.SCHEMA_ERROR);
    }

    jwsPayload?.vc?.type && jwsPayload?.vc?.type.forEach(t => {
        if (!Object.values(supportedTypes).includes(t)) {
            log.warn(`JWS.payload.vc.type : '${t}' is an unknown Verifiable Credential (VC) type (see: https://spec.smarthealth.cards/vocabulary/)`, ErrorCode.SCHEMA_ERROR);
        }
    });

    return log;
}
