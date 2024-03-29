#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* Validate SMART Health Card artifacts */
import path from 'path';
import fs from 'fs';
import { Option, Command } from 'commander';
import * as validator from './validate';
import Log, { LogLevels, note } from './logger';
import { getFileData } from './file';
import { ErrorCode, ExcludableErrors, getExcludeErrorCodes } from './error';
import * as utils from './utils'
import npmpackage from '../package.json';
import { KeySet } from './keys';
import { ValidationProfiles, Validators } from './fhirBundle';
import * as versions from './check-for-update';
import semver from 'semver';
import { } from './jws-compact';
import color from 'colors';
import { setTrustedIssuerDirectory } from './issuerDirectory';
import { setOptions } from './options';

/**
 *  Defines the program
 *  see https://www.npmjs.com/package/commander for documentation
 *  -h/--help auto-generated
 */
const loglevelChoices = ['debug', 'info', 'warning', 'error', 'fatal'];
const artifactTypes = ['fhirbundle', 'jwspayload', 'jws', 'healthcard', 'fhirhealthcard', 'qrnumeric', 'qr', 'jwkset', 'shlink', 'shlpayload', 'shlmanifest', 'shlfile'];
const profileChoices = ['any', 'usa-covid19-immunization'];
const program = new Command();
program.version(npmpackage.version, '-v, --version', 'display specification and tool version');
program.requiredOption('-p, --path <path>', 'path of the file(s) to validate.',
    (p: string, paths: string[]) => paths.concat([p]), []);
program.addOption(new Option('-t, --type <type>', 'type of file to validate').choices(artifactTypes));
program.addOption(new Option('-l, --loglevel <loglevel>', 'set the minimum log level').choices(loglevelChoices).default('warning'));
program.addOption(new Option('-P, --profile <profile>', 'vaccination profile to validate').choices(profileChoices).default('any'));
program.option('-d, --directory <directory>', 'trusted issuer directory to validate against');
program.option('-o, --logout <path>', 'output path for log (if not specified log will be printed on console)');
program.option('-f, --fhirout <path>', 'output path for the extracted FHIR bundle');
program.option('-k, --jwkset <key>', 'path to trusted issuer key set');
program.option('-e, --exclude <error>', 'error to exclude, can be repeated, can use a * wildcard. Valid options:' +
    ExcludableErrors.map(e => ` "${e.error}"`).join(),
    (e: string, errors: string[]) => errors.concat([e]), []);
program.addOption(new Option('-V, --validator <validator>', 'the choice of FHIR validator to use (cannot be used with non-default --profile)').choices(Object.keys(Validators).filter(x => Number.isNaN(Number(x)))));
program.option('-T, --valTime <valTime>', 'validation time for SHC and certificates (in seconds from UNIX epoch)');
program.option('-c, --passcode <code>', 'passcode for shlink');
program.option('-K, --key <key>', 'key for shlink decryption');
program.parse(process.argv);

export interface CliOptions {
    path: string[];
    type: ValidationType;
    jwkset: string;
    loglevel: string;
    profile: string;
    directory: string;
    logout: string;
    fhirout: string;
    exclude: string[];
    clearKeyStore?: boolean;
    validator: string;
    valTime: string;
    passcode: string;
    key: string;
}


function exit(message: string, exitCode: ErrorCode = 0): void {
    process.exitCode = exitCode;
    console.log(message);
}


/**
 * Processes the program options and launches validation
 */
async function processOptions(cliOptions: CliOptions) {

    console.log(color.dim("SMART Health Card Dev Tools v" + npmpackage.version) + '\n');

    const options = setOptions();

    // check the latest tools and spec version
    const vLatestDevTools = versions.latestDevToolsVersion();
    const vLatestSpec = versions.latestSpecVersion();


    // map the --loglevel option to the Log.LogLevel enum
    const level = loglevelChoices.indexOf(cliOptions.loglevel) as LogLevels;


    // verify that the directory of the logfile exists, if provided
    if (cliOptions.logout) {
        const logDir = path.dirname(path.resolve(cliOptions.logout));
        if (!fs.existsSync(logDir)) {
            return exit('Log file directory does not exist : ' + logDir, ErrorCode.LOG_PATH_NOT_FOUND);
        }
    }


    // set the log exclusions
    if (cliOptions.exclude) {
        Log.Exclusions = getExcludeErrorCodes(cliOptions.exclude);
    }


    // set global options
    options.skipJwksDownload = !!cliOptions.jwkset;


    // verify that the directory of the fhir output file exists, if provided
    if (cliOptions.fhirout) {
        const logDir = path.dirname(path.resolve(cliOptions.fhirout));
        if (!fs.existsSync(logDir)) {
            return exit('FHIR output file directory does not exist : ' + logDir, ErrorCode.LOG_PATH_NOT_FOUND);
        }
        options.logOutputPath = cliOptions.fhirout;
    }


    options.validator =
        cliOptions.validator ?
            Validators[cliOptions.validator as keyof typeof Validators] :
            Validators.default;


    options.profile =
        cliOptions.profile ?
            ValidationProfiles[cliOptions.profile as keyof typeof ValidationProfiles] :
            ValidationProfiles.any;


    // --profile usa-covid19-immunization & --validator fhirvalidator are mutually exclusive
    if (
        options.validator === Validators.fhirvalidator &&
        options.profile === ValidationProfiles['usa-covid19-immunization']
    ) {
        console.log("Invalid option combination, cannot specify both --profile usa-covid19-immunization and --validator fhirvalidator");
        console.log(options);
        program.help();
        return;
    }

    // set the validation time
    if (cliOptions.valTime) {
        if (parseInt(cliOptions.valTime) < 0) {
            console.log("Invalid validation time: " + cliOptions.valTime);
            return;
        }
        options.validationTime = cliOptions.valTime;
    }
    
    // set the passcode
    if (cliOptions.passcode) {
        options.passCode = cliOptions.passcode;
    }

    // set the shlink decryption key
    if (cliOptions.key) {
        options.decryptionKey = cliOptions.key;
    }
        
    // requires both --path and --type properties
    if (cliOptions.path.length === 0 || !cliOptions.type) {
        console.log("Invalid option, missing '--path' or '--type'");
        console.log(cliOptions);
        program.help();
        return;
    }

    // only 'qr' and 'qrnumeric' --type supports multiple --path arguments
    if (cliOptions.path.length > 1 && !(cliOptions.type === 'qr') && !(cliOptions.type === 'qrnumeric')) {
        return exit("Only the 'qr' and 'qrnumeric' types can have multiple --path options");
    }

    // check the trusted issuer directory
    if (cliOptions.directory) {
        await setTrustedIssuerDirectory(cliOptions.directory);
    }

    // read the data file(s) to validate
    const fileData = [];
    for (let i = 0; i < cliOptions.path.length; i++) {
        const path = cliOptions.path[i];
        try {
            fileData.push(await getFileData(path));
        } catch (error) {
            return exit((error as Error).message, ErrorCode.DATA_FILE_NOT_FOUND);
        }
    }


    // cannot provide a key file to both --path and --jwkset
    if (cliOptions.jwkset && cliOptions.type === 'jwkset') {
        return exit("Cannot pass a key file to both --path and --jwkset");
    }


    // if we have a key option, validate it and add it to the global key store
    if (cliOptions.jwkset) {

        let keys;

        try {
            keys = utils.loadJSONFromFile<KeySet>(cliOptions.jwkset);
        } catch (error) {
            return exit((error as Error).message, ErrorCode.DATA_FILE_NOT_FOUND);
        }

        // validate the key/keyset
        const output = await validator.validateKey(keys, cliOptions.valTime);
        process.exitCode = output.exitCode;


        // if a logfile is specified, append to the specified logfile
        cliOptions.logout ?
            output.toFile(cliOptions.logout, cliOptions, true) :
            console.log(output.toString(level));
    }


    // validate the specified key-set
    if (cliOptions.type === 'jwkset') {

        const keys = JSON.parse(fileData[0].buffer.toString('utf-8')) as KeySet;

        // validate the key/keyset
        const output = await validator.validateKey(keys, cliOptions.valTime);
        process.exitCode = output.exitCode;

        // if a logfile is specified, append to the specified logfile
        cliOptions.logout ?
            output.toFile(cliOptions.logout, cliOptions, true) :
            console.log(output.toString(level));
    }


    // validate the specified artifact ('fhirbundle', 'jwspayload', 'jws', 'healthcard', 'fhirhealthcard', 'qrnumeric', 'qr')
    if (cliOptions.type !== 'jwkset') {

        // validate a health card
        const output = await validator.validateCard(fileData, cliOptions.type, options);
        process.exitCode = output.exitCode;

        // if a logfile is specified, append to the specified logfile
        cliOptions.logout ?
            output.toFile(cliOptions.logout, cliOptions, true) :
            console.log(output.toString(level));
    }

    // check if we are running the latest version of the dev tools
    await vLatestDevTools.then(v => {
        if (!v) {
            console.log("Can't determine the latest dev tools version. Make sure you have the latest version.")
        } else if (semver.gt(v, npmpackage.version)) {
            note(`You are not using the latest dev tools version. Current: v${npmpackage.version}, latest: v${v}\nYou can update by running 'npm run update-validator'.`);
        }
    });

    // check if the dev tools package is behind the spec
    await vLatestSpec.then(v => {
        if (!v) {
            console.log("Can't determine the latest spec version.");
        } else if (semver.gt(v, npmpackage.version.substr(0, 'x.y.z'.length))) { // ignore prerelease tag
            note(`The dev tools script v${npmpackage.version} is not validating the latest version of the spec: v${v}`);
        }
    });

    console.log("\nValidation completed");
}


// start the program
// es5 compat requires await not be at the top level
void (async () => {
    await processOptions(program.opts() as CliOptions);
})();
