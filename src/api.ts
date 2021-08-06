import * as healthCard from './healthCard';
import * as fhirHealthCard from './fhirHealthCard';
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
import { clearTrustedIssuerDirectory, setTrustedIssuerDirectory } from './issuerDirectory';


function formatOutput(log: Log, logLevel: LogLevels): ValidationErrors {

    return log
        .log
        .map(e => {
            return { message: e.message, code: e.code, level: e.logLevel };
        })
        .filter(f => f.level >= logLevel);
}

interface IOptions {
    logLevel?: LogLevels,
    profile?: ValidationProfiles,
    directory?: string
}

async function validateKeySet(text: string, options?: IOptions): Promise<ValidationErrors> {

    const keySet = parseJson<KeySet>(text);
    if (keySet == null) {
        return [{ message: "Unable to parse as JSON", code: ErrorCode.JSON_PARSE_ERROR, level: LogLevels.ERROR }];
    }

    const keySetLog = await verifyAndImportHealthCardIssuerKey(keySet);
    return formatOutput(keySetLog, options?.logLevel || LogLevels.WARNING);
}

async function validateQrnumeric(shc: string[], options?: IOptions): Promise<ValidationErrors> {
    const log = await qr.validate(shc);
    return formatOutput(log, options?.logLevel || LogLevels.WARNING);
}

async function validateHealthcard(json: string, options?: IOptions): Promise<ValidationErrors> {
    const log = await healthCard.validate(json);
    return formatOutput(log, options?.logLevel || LogLevels.WARNING);
}

async function validateFhirHealthcard(json: string, options?: IOptions): Promise<ValidationErrors> {
    const log = await fhirHealthCard.validate(json);
    return formatOutput(log, options?.logLevel || LogLevels.WARNING);
}

async function validateJws(text: string, options?: IOptions): Promise<ValidationErrors> {
    const log = await jws.validate(text);
    return formatOutput(log, options?.logLevel || LogLevels.WARNING);
}

async function validateJwspayload(payload: string, options?: IOptions): Promise<ValidationErrors> {
    options?.directory ? await setTrustedIssuerDirectory(options.directory) : clearTrustedIssuerDirectory();
    const log = jwsPayload.validate(payload);
    return Promise.resolve(formatOutput(log, options?.logLevel || LogLevels.WARNING));
}

async function validateFhirBundle(json: string, options?: IOptions): Promise<ValidationErrors> {
    FhirOptions.ValidationProfile = options?.profile || ValidationProfiles.any;
    const log = fhirBundle.validate(json);
    return Promise.resolve(formatOutput(log, options?.logLevel || LogLevels.WARNING));
}

export { ErrorCode } from './error';

export { LogLevels } from './logger';

export type ValidationErrors = { message: string, code: ErrorCode, level: LogLevels }[];

export const validate = {
    "qrnumeric": validateQrnumeric,
    "healthcard": validateHealthcard,
    "fhirhealthcard": validateFhirHealthcard,
    "jws": validateJws,
    "jwspayload": validateJwspayload,
    "fhirbundle": validateFhirBundle,
    "keyset": validateKeySet
}

export { ValidationProfiles };

