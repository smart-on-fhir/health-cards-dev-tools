// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import path from 'path';
import fs from 'fs';

export enum ValidationErrors {
    UNKNOWN,
    // TODO: all errors
}

export enum LogLevels {
    // Print out everything
    DEBUG = 0,
    // Print out informational messages
    INFO,
    // Only print out warnings
    WARNING,
    // Only print out errors
    ERROR,
    // Only print out fatal errors, where processing can't continue
    FATAL
}

interface LogEntry {
    level: LogLevels,
    validationError: ValidationErrors,
    message: string,
    details?: unknown
}

/**
 * Logs application messages. Each message has a level; the message will be
 * printed if its level is higher than the logger's verbosity.
 */
class Logger {

    /**
     * Constructs a logger.
     * @param level mininum verbosity level to log
     * @param outFilePath path to output the logs to if specified, console otherwise
     */
    constructor(level: LogLevels, outFilePath?: string) {
        this._verbosity = level;

        if (outFilePath) {
            // create new console that writes to file
            outFilePath = path.normalize(outFilePath);
            const ws = fs.createWriteStream(outFilePath);
            this._console = new console.Console(ws, ws);
            this._usesStdOut = false;
        }
    }

    _console: Console = console;
    _usesStdOut = true;
    _verbosity: LogLevels;
    _logEntries: LogEntry[] = [];
    _prefix = false;

    get verbosity(): LogLevels {
        return this._verbosity;
    }

    set verbosity(level: LogLevels) {
        if (!Number.isInteger(level) || level < LogLevels.DEBUG || level > LogLevels.FATAL) {
            throw new Error("Invalid verbosity level");
        }
        this._verbosity = level;
    }

    set prefix(on: boolean) {
        this._prefix = on;
    }

    color(s: string, color: string): string {
        if (this._usesStdOut) {
            // color the output, only on STDOUT
            // if (color == 'red') {
            //     s = '\x1b[31m' + s + '\x1b[0m'; // red - message - reset
            // } else if (color == 'yellow') {
            //     s = '\x1b[33m' + s + '\x1b[0m'; // yellow - message - reset
            // } else {
            //     // don't know what that is, leave as is
            // }
        }
        return s;
    }


    log(message: string, level: LogLevels = LogLevels.INFO, validationError?: ValidationErrors, details?: unknown): void {
        
        if (!validationError) {
            validationError = ValidationErrors.UNKNOWN;
        }
        if (this._prefix) {
            message = level.toString() + ": " + message;
        }
        this._logEntries.push({
            level: level,
            validationError: validationError,
            message: message,
            details: details
        });
        if (level >= this._verbosity) {
            // print to console
            if (level == LogLevels.DEBUG || level == LogLevels.INFO) {
                this._console.log(message);
            } else if (level == LogLevels.WARNING) {
                this._console.log(this.color(message, 'yellow'));
                // this._console.log('\x1b[33m%s\x1b[0m', message); // yellow - message - reset
            } else if (level == LogLevels.ERROR || level == LogLevels.FATAL) {
                this._console.log(this.color(message, 'red'));
                // this._console.log('\x1b[31m%s\x1b[0m', message); // red - message - reset
            }
            if (details != null) {
                // log details on a separate call to avoid stringification
                this._console.log(details);
            }
        }
    }

    error(message: string, level: LogLevels = LogLevels.ERROR, details?: unknown) {
        log(message, level, undefined, details);
    }
}

export const logger = new Logger(LogLevels.WARNING /* 'out.log'*/);

export default function log(message: string, level: LogLevels = LogLevels.INFO, validationError?: ValidationErrors, details?: unknown) : void {
    return logger.log(message, level, validationError, details);
}

const logWrapper = function (level: LogLevels) {
    function f(message: string, validationError?: ValidationErrors, details?: unknown): void {
        return logger.log(message, level, validationError, details);
    }
    return f;
};

log.debug = logWrapper(LogLevels.DEBUG);
log.error = logWrapper(LogLevels.ERROR);
log.fatal = logWrapper(LogLevels.FATAL);
log.info = logWrapper(LogLevels.INFO);
log.warn = logWrapper(LogLevels.WARNING);

log.setLevel = function (level: LogLevels) {
    logger.verbosity = level;
};

log.setPrefix = function (on: boolean) {
    logger.prefix = on;
};