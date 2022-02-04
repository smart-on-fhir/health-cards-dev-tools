// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { ErrorCode } from './error';
import healthCardSchema from '../schema/smart-health-card-schema.json';
import * as jws from './jws-compact';
import Log from './logger';
import { IOptions } from './options';


export const schema = healthCardSchema;


export async function validate(healthCardText: string, options: IOptions): Promise<Log> {

    const log = new Log('SMART Health Card');

    if (healthCardText.trim() !== healthCardText) {
        log.error(`Health Card has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        healthCardText = healthCardText.trim();
    }

    const healthCard = utils.parseJson<HealthCard>(healthCardText);
    if (healthCard == undefined) {
        return log.fatal("Failed to parse HealthCard data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    // failures will be recorded in the log. we can continue processing.
    validateSchema(healthCardSchema, healthCard, log);


    // to continue validation, we must have a jws-compact string to validate
    const vc = healthCard.verifiableCredential;
    if (
        !vc ||
        !(vc instanceof Array) ||
        vc.length === 0 ||
        vc.find(e => {typeof e !== 'string'})
    ) {
        // The schema check above will list the expected properties/type
        return log.fatal("HealthCard.verifiableCredential[jws-compact] required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }

    if (options.cascade) {
    for (let i = 0; i < vc.length; i++) {
            log.child.push((await jws.validate(vc[i], options, vc.length > 1 ? i.toString() : '')));
        }
    }

    return log;
}
