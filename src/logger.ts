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
    public child: Log[] = [];
    public log: LogItem[] = [];
    // static exclusion list, because each Log object is constructed in different files
    public static Exclusions: Set<ErrorCode> = new Set<ErrorCode>();
    private _exitCode = 0;

    constructor(public title: string = '') { }

    public get exitCode(): number {

        this.child.forEach(c => {
            // set this exit code to the child if it's currently 0
            this._exitCode = this._exitCode || c.exitCode;
        });

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
        if (code == null || code <= 0) {
            throw new Error("Non-zero error code required.");
        }
        if (!Log.Exclusions.has(code)) {
            this.log.push(new LogItem(message, code, LogLevels.WARNING));
        }
        return this;
    }

    error(message: string, code: ErrorCode = ErrorCode.ERROR): Log {
        if (code == null || code <= 0) {
            throw new Error("Non-zero error code required.");
        }
        if (!Log.Exclusions.has(code)) {
            this.log.push(new LogItem(message, code, LogLevels.ERROR));
        }
        return this;
    }

    fatal(message: string, code: ErrorCode = ErrorCode.ERROR): Log {
        if (code == null || code <= 0) {
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

        let items = this.log
            .filter((item) => {
                return item.logLevel >= level;
            })
            .map(e => {
                return { title: this.title, message: e.message, code: e.code, level: e.logLevel };
            });

        this.child.forEach(c => items = items.concat(c.flatten(level)));

        return items;
    }

    toString(level: LogLevels = LogLevels.INFO): string {
        return formatOutput(this, level).join('\n');
    }

    toFile(path: string, options: CliOptions, append = true): void {
        return toFile(this, path, options, append);
    }

}


function list(title: string, items: LogItem[], color: (c: string) => string) {

    const results: string[] = items.length ? [color(title)] : [];

    items.forEach(e => {
        const lines = e.message.split('\n');
        lines.forEach((l, i) => results.push(color((i === 0 ? '  · ' : '    ') + l)));
    });

    return results;
}


function formatOutput(outputTree: Log, level: LogLevels): string[] {

    let results: string[][] = [];

    switch (level) {

        case LogLevels.DEBUG:
            results.push(list("Debug", outputTree.get(LogLevels.DEBUG), color.gray));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.INFO:
            results.push(list("Info", outputTree.get(LogLevels.INFO), color.white.dim));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.WARNING:
            results.push(list("Warning", outputTree.get(LogLevels.WARNING), color.yellow));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.ERROR:
            results.push(list("Error", outputTree.get(LogLevels.ERROR), color.red));
        // eslint-disable-next-line no-fallthrough
        case LogLevels.FATAL:
            results.push(list("Fatal", outputTree.get(LogLevels.FATAL), color.red.inverse));
    }

    // remove empty entries
    results = results.filter(r => r.length);

    outputTree.child.forEach(c => results.push(formatOutput(c, level)));

    return [color.bold(outputTree.title)].concat(results.map<string[]>((r, i) => {
        const lastChild = (i === results.length - 1);
        return [lines[0]].concat(r.map((s, j) => {
            if (j === 0 && lastChild) { return lines[1] + s; }
            if (j === 0) { return lines[2] + s; }
            if (lastChild) { return lines[3] + s; }
            return lines[0] + s;
        }));
    }).flat());

}


const indentL = '   ';
const indentR = '  ';
const lines = [
    color.dim(indentL + '│' + indentR),
    color.dim(indentL + '└─' + indentR.slice(0, indentR.length - 1)),
    color.dim(indentL + '├─' + indentR.slice(0, indentR.length - 1)),
    color.dim(indentL + ' ' + indentR)
];


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

// standardized the 'Note' message
export function note(message: string) : void {
    console.log(`\n${color.white.bold('Note:')} ${color.white.dim(message)}\n`);
}
