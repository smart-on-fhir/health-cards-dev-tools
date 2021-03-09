// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import { ErrorCode } from './error';
import color from 'colors';
import { CliOptions } from './shc-validator';


export class LogItem {
    constructor(public message: string, public code: ErrorCode = 0, public logLevel: LogLevels = LogLevels.INFO) { }
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


// eslint-disable-next-line no-var
export default class Log {
    public child: Log | undefined;
    public log: LogItem[] = [];
    private _exitCode = 0;

    constructor(public title: string = '') { }

    public get exitCode(): number {

        if (this.child) {
            const childExitCode = this.child.exitCode;

            // the child should not return a different fatal exitCode
            if (this._exitCode && (childExitCode === this._exitCode)) {
                throw new Error("Exit code overwritten. Should only have one fatal error.");
            }

            // set this exit code to the child if it's currently 0
            this._exitCode = this._exitCode || childExitCode;
        }

        return this._exitCode;
    }

    debug(message: string): Log {
        this.log.push(new LogItem(message, 0, LogLevels.DEBUG));
        return this;
    }

    info(message: string): Log {
        this.log.push(new LogItem(message, 0, LogLevels.INFO));
        return this;
    }

    warn(message: string, code: ErrorCode = ErrorCode.ERROR): Log {
        if (code == null || code === 0) {
            throw new Error("Non-zero error code required.");
        }
        this.log.push(new LogItem(message, code, LogLevels.WARNING));
        return this;
    }

    error(message: string, code: ErrorCode = ErrorCode.ERROR): Log {
        if (code == null || code === 0) {
            throw new Error("Non-zero error code required.");
        }
        this.log.push(new LogItem(message, code, LogLevels.ERROR));
        return this;
    }

    fatal(message: string, code: ErrorCode = ErrorCode.ERROR): Log {
        if (code == null || code === 0) {
            throw new Error("Non-zero error code required.");
        }
        if (this._exitCode !== 0) {
            throw new Error("Exit code overwritten. Should only have one fatal error.");
        }
        this._exitCode = code;
        this.log.push(new LogItem(message, code, LogLevels.FATAL));
        return this;
    }

    get(level: LogLevels): LogItem[] {
        return this.log.filter(item => {
            return item.logLevel === level;
        });
    }

    // collects errors from all children into a single collection; specify level to filter >= level
    flatten(level: LogLevels = LogLevels.DEBUG): { title: string, message: string, code: ErrorCode, level: LogLevels }[] {

        const items = this.log
            .filter((item) => {
                return item.logLevel >= level;
            })
            .map(e => {
                return { title: this.title, message: e.message, code: e.code, level: e.logLevel };
            });

        return (this.child) ? items.concat(this.child.flatten(level)) : items;
    }

    toString(level: LogLevels = LogLevels.INFO): string {
        return formatOutput(this, '', level).join('\n');
    }

    toFile(path: string, options: CliOptions, append = true): void {
        return toFile(this, path, options, append);
    }

}


function list(title: string, items: LogItem[], indent: string, color: (c: string) => string) {

    const results: string[] = [];

    if (items.length === 0) return results;

    results.push(indent + "|");
    results.push([indent, "├─ ", color(title), ' : '].join(''));

    for (let i = 0; i < items.length; i++) {
        const lines = items[i].message.split('\n');
        for (let j = 0; j < lines.length; j++) {
            results.push([indent, '|    ', color(lines[j])].join(''));
        }
    }

    return results;
}


function formatOutput(outputTree: Log, indent: string, level: LogLevels): string[] {

    let results: string[] = [];

    results.push(indent + color.bold(outputTree.title));
    indent = '    ' + indent;

    switch (level) {

        case LogLevels.DEBUG:
            results = results.concat(list("Debug", outputTree.get(LogLevels.DEBUG), indent + ' ', color.gray));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.INFO:
            results = results.concat(list("Info", outputTree.get(LogLevels.INFO), indent + ' ', color.white.dim));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.WARNING:
            results = results.concat(list("Warning", outputTree.get(LogLevels.WARNING), indent + ' ', color.yellow));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.ERROR:
            results = results.concat(list("Error", outputTree.get(LogLevels.ERROR), indent + ' ', color.red));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.FATAL:
            results = results.concat(list("Fatal", outputTree.get(LogLevels.FATAL), indent + ' ', color.red.inverse));
    }

    if (outputTree.child) {
        results.push(indent + ' |');
        results = results.concat(formatOutput(outputTree.child, indent, level));
    } else {
        makeLeaf(results);
    }

    return results;
}

// removes the line leading to the next child
function makeLeaf(items: string[]) {
    for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].trim()[0] === '├') {
            items[i] = items[i].replace('├', '└');
            break;
        }
        items[i] = items[i].replace('|', ' ');
    }
}


function toFile(log: Log, logPath: string, options: CliOptions, append = true) {

    let fileContents: Array<Record<string, unknown>> = [];

    // if append, read the entire file and parse as JSON
    // append the current log
    // overwrite the existing file with everything
    if (append && fs.existsSync(logPath)) {
        fileContents = JSON.parse(fs.readFileSync(logPath).toString('utf-8')) as Array<Record<string, unknown>>;
    }

    // TypeScript really does not want to let you index enums by string
    const level = (LogLevels as unknown as { [key: string]: number })[options.loglevel.toLocaleUpperCase()];

    fileContents.push({
        "time": new Date().toString(),
        "options": options,
        "log": log.flatten(level)
    });

    fs.writeFileSync(logPath, JSON.stringify(fileContents, null, 4) + '\n');
}
