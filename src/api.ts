import * as healthCard from './healthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import * as qr from './qr';
import Log, { LogLevels } from './logger';
import { ErrorCode } from './error';
import { verifyAndImportHealthCardIssuerKey } from './shcKeyValidator';
import { parseJson } from './utils'
import { KeySet } from './keys';


function formatOutput(log: Log, logLevel: LogLevels): ValidationErrors {

    return log
        .log
        .map(e => {
            return { message: e.message, code: e.code, level: e.logLevel };
        })
        .filter(f => f.level >= logLevel);
}

async function validateKeySet(text : string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    
    const keySet = parseJson<KeySet>(text);
    if(keySet == null) {
        return [{message: "Unable to parse as JSON", code : ErrorCode.JSON_PARSE_ERROR, level : LogLevels.ERROR}];
    }

    const result = await verifyAndImportHealthCardIssuerKey(keySet);
    return formatOutput(result.log, logLevel);
}

async function validateQrnumeric(shc: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const result = await qr.validate([shc]);
    return formatOutput(result.log, logLevel);
}

async function validateHealthcard(json: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const result = await healthCard.validate(json);
    return formatOutput(result.log, logLevel);
}

async function validateJws(text: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const result = await jws.validate(text);
    return formatOutput(result.log, logLevel);
}

function validateJwspayload(payload: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const result = jwsPayload.validate(payload);
    return Promise.resolve(formatOutput(result.log, logLevel));
}

function validateFhirBundle(json: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const result = fhirBundle.validate(json);
    return Promise.resolve(formatOutput(result.log, logLevel));
}

export { ErrorCode } from './error';

export { LogLevels } from './logger';

export type ValidationErrors = { message: string, code: ErrorCode, level: LogLevels }[];

export const validate = {
    "qrnumeric": validateQrnumeric,
    "healthcard": validateHealthcard,
    "jws": validateJws,
    "jwspayload": validateJwspayload,
    "fhirbundle": validateFhirBundle,
    "keyset" : validateKeySet
}
