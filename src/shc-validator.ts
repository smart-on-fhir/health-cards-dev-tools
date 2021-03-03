// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* Validate SMART Health Card artifacts */
import path from 'path';
import fs from 'fs';
import { Option, Command } from 'commander';
import * as validator from './validate';
import log, { LogLevels } from './logger';
import { getFileData } from './file';
import { ErrorCode } from './error';
import * as keys from './keys';


/**
 *  Defines the program
 *  see https://www.npmjs.com/package/commander for documentation
 *  -h/--help auto-generated
 */
const loglevelChoices = ['debug', 'info', 'warning', 'error', 'fatal'];
const program = new Command();
program.version('0.1.1', '-v, --version', 'display specification and tool version'); // TODO: how to get this from package.json?
program.requiredOption('-p, --path <path>', 'path of the file to validate');
program.addOption(new Option('-t, --type <type>', 'type of file to validate').choices(['fhirbundle', 'jwspayload', 'jws', 'healthcard', 'qrnumeric', 'qr', 'jwkset'])); // TODO: populate this from the validate enum.
program.addOption(new Option('-l, --loglevel <loglevel>', 'set the minimum log level').choices(loglevelChoices).default('warning'));
program.option('-o, --logout <path>', 'output path for log (if not specified log will be printed on console)');
program.option('-k, --jwkset <key>', 'path to trusted issuer key set');
program.parse(process.argv);

interface Options {
    path: string;
    type: validator.ValidationType;
    jwkset: string;
    loglevel: string;
    logout: string;
}

/**
 * Processes the program options and launches validation
 */
async function processOptions() {
    const options = program.opts() as Options;
    let logFilePathIsValid = false;

    // verify that the directory of the logfile exists
    if (options.logout) {
        const logDir = path.dirname(path.resolve(options.logout));
        if(!fs.existsSync(logDir)){
            log.fatal('Cannot create log file at: ' + logDir);
            return;
        }
        logFilePathIsValid = true;
    }

    if (options.loglevel) {
        log.setLevel(loglevelChoices.indexOf(options.loglevel) as LogLevels);
    }

    if (options.path && options.type) {
        // read the file to validate
        let fileData;
        try {
            fileData = await getFileData(options.path);
        } catch (error) {
            log.error((error as Error).message);
            process.exitCode = ErrorCode.DATA_FILE_NOT_FOUND;
            return;
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
            await validator.validateKey(fileData.buffer);

        } else {
            // validate a health card
            const output = await validator.validateCard(fileData, options.type);
            process.exitCode = output.exitCode;

            const level = loglevelChoices.indexOf(options.loglevel) as LogLevels;
            
            // append to the specified logfile
            if(logFilePathIsValid) {
                
                const out = {
                    "time" : new Date().toString(),
                    "options" : options,
                    "log" : output.flatten(level)
                };
                fs.appendFileSync(options.logout, JSON.stringify(out, null, 4) + '\n');
                fs.appendFileSync(options.logout, '\n--------------------------------------------------------------------------------');
            } else {
                if (output != null) {
                    log(validator.formatOutput(output, '').join('\n'), level);
                }
            }
        }

        console.log("Validation completed");

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
