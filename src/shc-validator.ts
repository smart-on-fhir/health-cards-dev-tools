// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* Validate SMART Health Card artifacts */
import path from 'path';
import fs from 'fs';
import { Option, Command } from 'commander';
import * as validator from './validate';
import Log, { LogLevels } from './logger';
import { getFileData } from './file';
import { ErrorCode } from './error';
import * as keys from './keys';
import npmpackage from '../package.json';

// function collect(value: string, previous: string[]) {
//     return previous.concat([value]);
// }

/**
 *  Defines the program
 *  see https://www.npmjs.com/package/commander for documentation
 *  -h/--help auto-generated
 */
const loglevelChoices = ['debug', 'info', 'warning', 'error', 'fatal'];
const program = new Command();
program.version(npmpackage.version, '-v, --version', 'display specification and tool version');
program.requiredOption('-p, --path <path>', 'path of the file(s) to validate. Can be repeated for the qr and qrnumeric types, to provide multiple file chunks',
    (p: string, paths: string[]) => paths.concat([p]), []);
program.addOption(new Option('-t, --type <type>', 'type of file to validate').choices(['fhirbundle', 'jwspayload', 'jws', 'healthcard', 'qrnumeric', 'qr', 'jwkset'])); // TODO: populate this from the validate enum.
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


const log = new Log('main');


/**
 * Processes the program options and launches validation
 */
async function processOptions() {
    const options = program.opts() as CliOptions;
    let logFilePathIsValid = false;

    // verify that the directory of the logfile exists
    if (options.logout) {
        const logDir = path.dirname(path.resolve(options.logout));
        if (!fs.existsSync(logDir)) {
            console.log('Cannot create log file at: ' + logDir);
            process.exitCode = ErrorCode.LOG_PATH_NOT_FOUND;
            return;
        }
        logFilePathIsValid = true;
    }

    if (options.path.length > 0 && options.type) {
        if (options.path.length > 1 && !(options.type === 'qr' || options.type === 'qrnumeric')) {
            console.log("Only the qr and qrnumeric types can have multiple path options")
            return; // TODO: add unit test
        }
        // read the file to validate
        const fileData = [];
        for (const path of options.path) {
            try {
                fileData.push(await getFileData(path));
            } catch (error) {
                log.error((error as Error).message);
                process.exitCode = ErrorCode.DATA_FILE_NOT_FOUND;
                return;
            }
        }

        // if we have a key option, parse is and add it to the global key store
        if (options.jwkset) {
            // creates a new keyStore from a JSON key set file
            // const keyStore: JWK.KeyStore = await createKeyStoreFromFile(options.key);
            await keys.initKeyStoreFromFile(options.jwkset);
            log.debug('keyStore');
        }

        if (options.type === 'jwkset') {
            // validate a key file
            await validator.validateKey(fileData[0].buffer, log);
        } else {

            // validate a health card
            const output = await validator.validateCard(fileData, options.type);

            process.exitCode = output.log.exitCode;

            const level = loglevelChoices.indexOf(options.loglevel) as LogLevels;

            // append to the specified logfile
            if (logFilePathIsValid) {
                output.log.toFile(options.logout, options, true);
            } else {
                console.log(log.toString(level));
            }
        }

        console.log("Validation completed ");

    } else {
        console.log("Invalid option, missing 'path' or 'type'");
        console.log(options);
        program.help();
    }
}

// start the program
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await processOptions();
})();
