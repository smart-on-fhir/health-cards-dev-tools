// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* Validate SMART Health Card artifacts */
import path from 'path';
import fs from 'fs';
import { Option, Command } from 'commander';
import * as validator from './validate';
import { LogLevels } from './logger';
import { getFileData } from './file';
import { ErrorCode } from './error';
import * as utils from './utils'
import npmpackage from '../package.json';
import { KeySet } from './keys';

/**
 *  Defines the program
 *  see https://www.npmjs.com/package/commander for documentation
 *  -h/--help auto-generated
 */
const loglevelChoices = ['debug', 'info', 'warning', 'error', 'fatal'];
const artifactTypes = ['fhirbundle', 'jwspayload', 'jws', 'healthcard', 'qrnumeric', 'qr', 'jwkset'];
const program = new Command();
program.version(npmpackage.version, '-v, --version', 'display specification and tool version');
program.requiredOption('-p, --path <path>', 'path of the file(s) to validate. Can be repeated for the qr and qrnumeric types, to provide multiple file chunks',
    (p: string, paths: string[]) => paths.concat([p]), []);
program.addOption(new Option('-t, --type <type>', 'type of file to validate').choices(artifactTypes)); // TODO: populate this from the validate enum.
program.addOption(new Option('-l, --loglevel <loglevel>', 'set the minimum log level').choices(loglevelChoices).default('warning'));
program.option('-o, --logout <path>', 'output path for log (if not specified log will be printed on console)');
program.option('-k, --jwkset <key>', 'path to trusted issuer key set');
program.parse(process.argv);


export interface CliOptions {
    path: string[];
    type: validator.ValidationType;
    jwkset: string;
    loglevel: string;
    logout: string;
}


function exit(message: string, exitCode: ErrorCode = 0): void {
    process.exitCode = exitCode;
    console.log(message);
}


/**
 * Processes the program options and launches validation
 */
async function processOptions(options: CliOptions) {


    // map the --loglevel option to the Log.LogLevel enum
    const level = loglevelChoices.indexOf(options.loglevel) as LogLevels;


    // verify that the directory of the logfile exists, if provided
    if (options.logout) {
        const logDir = path.dirname(path.resolve(options.logout));
        if (!fs.existsSync(logDir)) {
            return exit('Log file directory does not exist : ' + logDir, ErrorCode.LOG_PATH_NOT_FOUND);
        }
    }


    // requires both --path and --type properties
    if (options.path.length === 0 || !options.type) {
        console.log("Invalid option, missing '--path' or '--type'");
        console.log(options);
        program.help();
        return;
    }


    // only 'qr' and 'qrnumeric' --type supports multiple --path arguments
    if (options.path.length > 1 && !(options.type === 'qr') && !(options.type === 'qrnumeric')) {
        return exit("Only the 'qr' and 'qrnumeric' types can have multiple --path options");
    }


    // read the data file(s) to validate
    const fileData = [];
    for (let i = 0; i < options.path.length; i++) {
        const path = options.path[i];
        try {
            fileData.push(await getFileData(path));
        } catch (error) {
            return exit((error as Error).message, ErrorCode.DATA_FILE_NOT_FOUND);
        }
    }


    // cannot provide a key file to both --path and --jwkset
    if (options.jwkset && options.type === 'jwkset') {
        return exit("Cannot pass a key file to both --path and --jwkset");
    }


    // if we have a key option, validate is and add it to the global key store
    if (options.jwkset) {

        let keys;

        try {
            keys = utils.loadJSONFromFile<KeySet>(options.jwkset);
        } catch (error) {
            return exit((error as Error).message, ErrorCode.DATA_FILE_NOT_FOUND);
        }

        // validate the key/keyset
        const output = await validator.validateKey(keys);
        process.exitCode = output.log.exitCode;


        // if a logfile is specified, append to the specified logfile
        options.logout ?
            output.log.toFile(options.logout, options, true) :
            console.log(output.log.toString(level));
    }


    // validate the specified key-set
    if (options.type === 'jwkset') {

        const keys = JSON.parse(fileData[0].buffer.toString('utf-8')) as KeySet;

        // validate the key/keyset
        const output = await validator.validateKey(keys);
        process.exitCode = output.log.exitCode;

        // if a logfile is specified, append to the specified logfile
        options.logout ?
            output.log.toFile(options.logout, options, true) :
            console.log(output.log.toString(level));
    }


    // validate the specified artifact ('fhirbundle', 'jwspayload', 'jws', 'healthcard', 'qrnumeric', 'qr')
    if (options.type !== 'jwkset') {

        // validate a health card
        const output = await validator.validateCard(fileData, options.type);
        process.exitCode = output.log.exitCode;

        // if a logfile is specified, append to the specified logfile
        options.logout ?
            output.log.toFile(options.logout, options, true) :
            console.log(output.log.toString(level));
    }

    console.log("Validation completed");
}


// start the program
// es5 compat requires await not be at the top level
void (async () => {
    await processOptions(program.opts() as CliOptions);
})();
