import * as healthCard from './healthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import { FhirOptions, ValidationProfiles } from './fhirBundle';
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

    const keySetLog = await verifyAndImportHealthCardIssuerKey(keySet);
    return formatOutput(keySetLog, logLevel);
}

async function validateQrnumeric(shc: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const log = await qr.validate([shc]);
    return formatOutput(log, logLevel);
}

async function validateHealthcard(json: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const log = await healthCard.validate(json);
    return formatOutput(log, logLevel);
}

async function validateJws(text: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const log = await jws.validate(text);
    return formatOutput(log, logLevel);
}

async function validateJwspayload(payload: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const log = jwsPayload.validate(payload);
    return Promise.resolve(formatOutput(log, logLevel));
}

async function validateFhirBundle(json: string, logLevel: LogLevels = LogLevels.WARNING): Promise<ValidationErrors> {
    const log = fhirBundle.validate(json);
    return Promise.resolve(formatOutput(log, logLevel));
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
    "keyset" : validateKeySet,
    "profile" : ValidationProfiles.any
}

export {ValidationProfiles};

Object.defineProperty(validate, "profile", {
    get : function () {
        return FhirOptions.ValidationProfile;
    }
});

Object.defineProperty(validate, "profile", {
    set : function (value : ValidationProfiles) {
        FhirOptions.ValidationProfile = value;
    }
});
