// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema } from './schema';
import { OutputTree, ErrorCode } from './error';
import healthCardSchema from '../schema/smart-health-card-schema.json';
import * as jws from './jws-compact';

export const schema = healthCardSchema;

export async function validate(healthCardText: string): Promise<OutputTree> {

    const output = new OutputTree('SMART Health Card');

    const healthCard = utils.parseJson<HealthCard>(healthCardText);
    if (healthCard == undefined) {
        return output
            .fatal("Failed to parse HealthCard data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    // returns [] if successful
    const schemaResults = validateSchema(healthCardSchema, healthCard);
    output.add(schemaResults);

    // to continue validation, we must have a jws-compact string to validate
    const vc = healthCard.verifiableCredential;
    if (
        !vc ||
        !(vc instanceof Array) ||
        vc.length === 0 ||
        typeof vc[0] !== 'string'
    ) {
        // The schema check above will list the expected properties/type
        return output.fatal(
            "HealthCard.verifiableCredential[jws-compact] required to contine.",
            ErrorCode.CRITICAL_DATA_MISSING);
    }

    output.child = await jws.validate(vc[0]);

    return output;
}
