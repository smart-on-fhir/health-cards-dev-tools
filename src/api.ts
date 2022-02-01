import * as healthCard from './healthCard';
import * as fhirHealthCard from './fhirHealthCard';
import * as jws from './jws-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import { ValidationProfiles } from './fhirBundle';
import * as qr from './qr';
import Log, { LogLevels } from './logger';
import { ErrorCode } from './error';
import { verifyAndImportHealthCardIssuerKey } from './shcKeyValidator';
import { parseJson } from './utils'
import keys, { KeySet } from './keys';
import { checkTrustedIssuerDirectory, clearTrustedIssuerDirectory, setTrustedIssuerDirectory } from './issuerDirectory';
import { IOptions, setOptions } from './options';


function formatOutput(log: Log, logLevel: LogLevels = LogLevels.WARNING): ValidationErrors {

    return log
        .log
        .map(e => {
            return { message: e.message, code: e.code, level: e.logLevel };
        })
        .filter(f => f.level >= logLevel);
}

async function validateKeySet(text: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});

    const keySet = parseJson<KeySet>(text);
    if (keySet == null) {
        return [{ message: "Unable to parse as JSON", code: ErrorCode.JSON_PARSE_ERROR, level: LogLevels.ERROR }];
    }

    const keySetLog = await verifyAndImportHealthCardIssuerKey(keySet);
    return formatOutput(keySetLog, fullOptions.logLevel);
}

async function validateQrnumeric(shc: string[], options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    const log = await qr.validate(shc, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateHealthcard(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    const log = await healthCard.validate(json, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateFhirHealthcard(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    const log = await fhirHealthCard.validate(json, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateJws(text: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    fullOptions.issuerDirectory ? await setTrustedIssuerDirectory(fullOptions.issuerDirectory) : clearTrustedIssuerDirectory();
    fullOptions.clearKeyStore  && keys.clear();
    const log = await jws.validate(text, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}
 
async function validateJwspayload(payload: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    const log = await jwsPayload.validate(payload, fullOptions);
    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
}

async function validateFhirBundle(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions({...options, cascade: false});
    const log = await fhirBundle.validate(json, fullOptions);
    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
}

async function checkTrustedDirectory(url: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {

    const fullOptions = setOptions({...options, cascade: false});
    const log = new Log('TrustedDirectory');
    const directory = fullOptions.issuerDirectory;

    directory && await setTrustedIssuerDirectory(directory, log);

    if (log.log.length) {
        return Promise.resolve(formatOutput(log, fullOptions.logLevel));
    }

    checkTrustedIssuerDirectory(url, log);

    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
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
    "keyset": validateKeySet,
    "checkTrustedDirectory": checkTrustedDirectory,
}

export { ValidationProfiles };
