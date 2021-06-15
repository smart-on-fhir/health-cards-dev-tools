// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';

// TODO: add schema validation as in healthCards.ts

export async function validate(fhirHealthCardText: string): Promise<Log> {

    const log = new Log('FHIR $health-cards-issue response');

    if (fhirHealthCardText.trim() !== fhirHealthCardText) {
        log.warn(`FHIR Health Card response has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        fhirHealthCardText = fhirHealthCardText.trim();
    }

    const fhirHealthCard = utils.parseJson<FhirHealthCard>(fhirHealthCardText);
    if (fhirHealthCard == undefined) {
        return log.fatal("Failed to parse FHIR Health Card response data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    const vc = fhirHealthCard.parameter;
    if (
        !vc ||
        !(vc instanceof Array) ||
        vc.length === 0 ||
        typeof vc[0].valueString !== 'string'
    ) {
        // The schema check above will list the expected properties/type
        return log.fatal("fhirHealthCard.parameter array required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }

    for (let i = 0; i < vc.length; i++) {
        log.child.push((await jws.validate(vc[i].valueString, vc.length> 1 ? i.toString() : '')));
    }

    return log;
}
