// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';


export async function validate(fhirHealthCardText: string): Promise<Log> {

    const log = new Log('FHIR Health Card');

    const fhirHealthCard = utils.parseJson<FhirHealthCard>(fhirHealthCardText);
    if (fhirHealthCard == undefined) {
        return log.fatal("Failed to parse Fhir HealthCard data as JSON.", ErrorCode.JSON_PARSE_ERROR);
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
