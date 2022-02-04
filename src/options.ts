import { LogLevels } from './logger';
import { ValidationProfiles, Validators } from './fhirBundle';

interface IOptions {
    logLevel: LogLevels,
    profile: ValidationProfiles,
    issuerDirectory: string,
    clearKeyStore: boolean,
    cascade: boolean,
    logOutputPath: string,
    skipJwksDownload: boolean,
    jwkset : string,
    validator: Validators
}

const defaultOptions: IOptions = {
    logLevel: LogLevels.WARNING,
    profile: ValidationProfiles['any'],
    issuerDirectory: '',
    clearKeyStore: false,
    cascade: true,
    logOutputPath: '',
    skipJwksDownload: false,
    jwkset : '',
    validator: Validators.default
}

const setOptions = function (options: Partial<IOptions> = {}): IOptions {

    // check if the passed in options are valid
    Object.keys(options).forEach(k => {
        if (!(k in defaultOptions)) throw new Error(`Unknown option ${k}`);
    });

    if (options) {
        if ('logLevel' in options && (!options.logLevel || !(options.logLevel in LogLevels))) throw new Error(`Invalid logLevel ${options.logLevel ?? ''}`);
        if ('profile' in options && (!options.profile || !(options.profile in ValidationProfiles))) throw new Error(`Invalid profile ${options.profile ?? ''}`);
        if ('issuerDirectory' in options && typeof options.issuerDirectory !== 'string') throw new Error(`Invalid issuerDirectory ${options.issuerDirectory ?? ''}`);
        if ('clearKeyStore' in options && typeof options.clearKeyStore !== 'boolean') throw new Error(`Invalid clearKeyStore ${options.clearKeyStore ?? ''}`);
        if ('cascade' in options && typeof options.cascade !== 'boolean') throw new Error(`Invalid cascade ${options.cascade ?? ''}`);
        if ('skipJwksDownload' in options && typeof options.skipJwksDownload !== 'boolean') throw new Error(`Invalid skipJwksDownload ${options.skipJwksDownload ?? ''}`);
        if ('logOutputPath' in options && typeof options.logOutputPath !== 'string') throw new Error(`Invalid logOutputPath ${options.logOutputPath ?? ''}`);
        if ('jwkset' in options && typeof options.jwkset !== 'string') throw new Error(`Invalid jwkset ${options.jwkset ?? ''}`);
        if ('validator' in options && (!options.validator || !(options.validator in Validators))) throw new Error(`Invalid validator ${options.validator ?? ''}`);
    }

    return { // this syntax merges two object into a single object. For common properties, the second entry wins.
        ...defaultOptions,
        ...options
    };
}

export { IOptions, setOptions };
