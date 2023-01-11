import * as healthCard from './healthCard';
import * as fhirHealthCard from './fhirHealthCard';
import * as jws from './jws-compact';
import * as jwe from './jwe-compact';
import * as jwsPayload from './jws-payload';
import * as fhirBundle from './fhirBundle';
import * as shlink from './shlink';
import * as shlPayload from './shlPayload';
import * as shlManifest from './shlManifest';
import * as shlManifestFile from "./shlManifestFile";
import { ValidationProfiles, Validators } from './fhirBundle';
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
        .flatten()
        .map(e => {
            return { message: e.message, code: e.code, level: e.level };
        })
        .filter(f => f.level >= logLevel);
}

async function validateKeySet(text: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);

    const keySet = parseJson<KeySet>(text);
    if (keySet == null) {
        return [{ message: "Unable to parse as JSON", code: ErrorCode.JSON_PARSE_ERROR, level: LogLevels.ERROR }];
    }

    const keySetLog = await verifyAndImportHealthCardIssuerKey(keySet, options.validationTime);
    return formatOutput(keySetLog, fullOptions.logLevel);
}

async function validateQrnumeric(shc: string[], options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await qr.validate(shc, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateShlink(shl: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await shlink.validate(shl, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateShlPayload(payload: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await shlPayload.validate(payload, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateShlManifest(manifest: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await shlManifest.validate(manifest, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateShlManifestFile(file: string, options: Partial<IOptions> = {}): Promise<ResultWithValidationErrors> {
    const fullOptions = setOptions(options);
    const resultWithErrors = await shlManifestFile.validate(file, fullOptions);
    return {result: resultWithErrors.result, errors: formatOutput(resultWithErrors.log, fullOptions.logLevel)};
}

async function validateHealthcard(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await healthCard.validate(json, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateFhirHealthcard(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await fhirHealthCard.validate(json, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateJws(text: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    fullOptions.issuerDirectory ? await setTrustedIssuerDirectory(fullOptions.issuerDirectory) : clearTrustedIssuerDirectory();
    fullOptions.clearKeyStore && keys.clear();
    const log = await jws.validate(text, fullOptions);
    return formatOutput(log, fullOptions.logLevel);
}

async function validateJwe(text: string, options: Partial<IOptions> = {}): Promise<ResultWithValidationErrors> {
    const fullOptions = setOptions(options);
    const resultWithErrors = await jwe.validate(text, fullOptions);
    return {result: resultWithErrors.result, errors: formatOutput(resultWithErrors.log, fullOptions.logLevel)};
}

async function validateJwspayload(payload: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await jwsPayload.validate(payload, fullOptions);
    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
}

async function validateFhirBundle(json: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {
    const fullOptions = setOptions(options);
    const log = await fhirBundle.validate(json, fullOptions);
    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
}

async function checkTrustedDirectory(url: string, options: Partial<IOptions> = {}): Promise<ValidationErrors> {

    const fullOptions = setOptions(options);
    const log = new Log('TrustedDirectory');
    const directory = fullOptions.issuerDirectory;

    directory && await setTrustedIssuerDirectory(directory, log);

    if (log.log.length) {
        return Promise.resolve(formatOutput(log, fullOptions.logLevel));
    }

    checkTrustedIssuerDirectory(url, log);

    return Promise.resolve(formatOutput(log, fullOptions.logLevel));
}

async function downloadManifest(params: ShlinkManifestRequest, options: Partial<IOptions> = {}) : Promise<{ errors: ValidationErrors, manifest: string}> {
    const fullOptions = setOptions(options);
    const log =new Log('Download-Manifest');
    const manifest = await shlPayload.downloadManifest(params, log);
    return {errors: formatOutput(log, fullOptions.logLevel), manifest};
}

async function downloadManifestFile(params: ShlinkManifestRequest, options: Partial<IOptions> = {}) : Promise<{ errors: ValidationErrors, manifest: string}> {
    const fullOptions = setOptions(options);
    const log =new Log('Download-Manifest');
    const manifest = await shlPayload.downloadManifest(params, log);
    return {errors: formatOutput(log, fullOptions.logLevel), manifest};
}

export { ErrorCode } from './error';

export { LogLevels } from './logger';

export type ValidationErrors = { message: string, code: ErrorCode, level: LogLevels }[];

export type ResultWithValidationErrors = {result: string, errors: ValidationErrors};

export const validate = {
    "qrnumeric": validateQrnumeric,
    "healthcard": validateHealthcard,
    "fhirhealthcard": validateFhirHealthcard,
    "jwe": validateJwe,
    "jws": validateJws,
    "jwspayload": validateJwspayload,
    "fhirbundle": validateFhirBundle,
    "keyset": validateKeySet,
    "checkTrustedDirectory": checkTrustedDirectory,
    "shlink": validateShlink,
    "shlpayload": validateShlPayload,
    "shlmanifest" : validateShlManifest,
    "shlmanifestfile" : validateShlManifestFile,
    "downloadManifest" : downloadManifest
}

export { ValidationProfiles, Validators, IOptions };
