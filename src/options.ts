import { LogLevels } from './logger';
import { ValidationProfiles } from './fhirBundle';

interface IOptions {
    logLevel: LogLevels,
    profile: ValidationProfiles,
    issuerDirectory: string,
    clearKeyStore: boolean,
    cascade: boolean,
    logOutputPath: string,
    skipJwksDownload: boolean
}

const defaultOptions: IOptions = {
    logLevel: LogLevels.WARNING,
    profile: ValidationProfiles['any'],
    issuerDirectory: '',
    clearKeyStore: false,
    cascade: true,
    logOutputPath: '',
    skipJwksDownload: false
}

const setOptions = function (options: Partial<IOptions> = {}): IOptions {
    return {
        ...defaultOptions,
        ...options
    }
}

export { IOptions, setOptions };
