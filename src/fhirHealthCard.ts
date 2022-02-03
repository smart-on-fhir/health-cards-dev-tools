// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { ErrorCode } from './error';
import * as jws from './jws-compact';
import Log from './logger';
import { IOptions } from './options';

// TODO: add schema validation as in healthCards.ts

export async function validate(fhirHealthCardText: string, options: IOptions): Promise<Log> {

    const log = new Log('FHIR $health-cards-issue response');

    if (fhirHealthCardText.trim() !== fhirHealthCardText) {
        log.error(`FHIR Health Card response has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        fhirHealthCardText = fhirHealthCardText.trim();
    }

    const fhirHealthCard = utils.parseJson<FhirHealthCard>(fhirHealthCardText);
    if (fhirHealthCard == undefined) {
        return log.fatal("Failed to parse FHIR Health Card response data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    const param = fhirHealthCard.parameter;
    if (
        !param ||
        !(param instanceof Array) ||
        param.length === 0
    ) {
        return log.fatal("fhirHealthCard.parameter array required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }
    await Promise.all(param.filter(p => p.name === 'verifiableCredential').map(async (vc, i, VCs) => {
        if (!vc.valueString) {
            log.error(`Missing FHIR Health Card response data verifiableCredential #${i + 1} valueString`, i);
        } else {
            options.cascade && log.child.push(await jws.validate(vc.valueString, options, VCs.length > 1 ? i.toString() : ''));
        }
    }));

    return log;
}
