// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { LogLevels } from "./logger";

// eslint-disable-next-line no-var // TODO: ljoy, can we delete this?
// export class OutputTree {
//     public child: OutputTree | undefined;
//     public infos: InfoItem[] = [];
//     public errors: ErrorItem[] = [];
//     private _exitCode = 0;

//     constructor(public title: string = '') { }

//     public get exitCode(): number {

//         if (this.child) {
//             const childExitCode = this.child.exitCode;

//             // the child should not return a different fatal exitCode
//             if (this._exitCode && (childExitCode === this._exitCode)) {
//                 throw new Error("Exit code overwritten. Should only have one fatal error.");
//             }

//             // set this exit code to the child if it's currently 0
//             this._exitCode = this._exitCode || childExitCode;
//         }

//         return this._exitCode;
//     }

//     error(errorItemArray: ErrorItem[]): OutputTree;
//     error(message: string): OutputTree;
//     error(message: string, code: ErrorCode): OutputTree;
//     error(message: string, code: ErrorCode, fatal: boolean): OutputTree;
//     error(message: string | ErrorItem[], code: ErrorCode = ErrorCode.ERROR, fatal = false): OutputTree {

//         if (typeof message === 'string') {

//             if (code == null || code === 0) {
//                 throw new Error("Non-zero error code required.");
//             }

//             if (fatal && this._exitCode !== 0) {
//                 throw new Error("Exit code overwritten. Should only have one fatal error.");
//             }

//             if (fatal) this._exitCode = code;

//             this.errors.push(new ErrorItem(message, code, fatal));

//             return this;
//         }

//         for (let i = 0; i < message.length; i++) {
//             const err = message[i];

//             if (err.fatal && this._exitCode !== 0) {
//                 throw new Error("Exit code overwritten. Should only have one fatal error.");
//             }

//             if (err.fatal) this._exitCode = err.code;

//             this.errors.push(err);
//         }

//         return this;
//     }

//     info(message: string, code: InfoCode = InfoCode.INFO): OutputTree {
//         this.infos.push(new InfoItem(message, code));
//         return this;
//     }

//     warn(message: string, code: InfoCode = InfoCode.INFO): OutputTree {
//         this.infos.push(new InfoItem(message, code));
//         return this;
//     }

//     // collects errors from all children into a single collection
//     flatten(): { title: string, message: string, code: ErrorCode, fatal: boolean }[] {

//         let errors = this.errors.map(e => {
//             return {
//                 title: this.title,
//                 message: e.message,
//                 code: e.code,
//                 fatal: e.fatal
//             };
//         });

//         if (this.child) errors = errors.concat(this.child.flatten());
//         return errors;
//     }

// }

// eslint-disable-next-line no-var
export class OutputTree {
    public child: OutputTree | undefined;
    public log: LogItem[] = [];
    public result: FhirBundle | JWS | JWSPayload | HealthCard | undefined = undefined;
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

    debug(message: string): OutputTree {
        this.log.push(new LogItem(message, 0, LogLevels.DEBUG));
        return this;
    }

    info(message: string): OutputTree {
        this.log.push(new LogItem(message, 0, LogLevels.INFO));
        return this;
    }

    warn(message: string, code: ErrorCode = ErrorCode.ERROR): OutputTree {
        if (code == null || code === 0) {
            throw new Error("Non-zero error code required.");
        }
        this.log.push(new LogItem(message, code, LogLevels.WARNING));
        return this;
    }

    error(message: string, code: ErrorCode = ErrorCode.ERROR): OutputTree {
        if (code == null || code === 0) {
            throw new Error("Non-zero error code required.");
        }
        this.log.push(new LogItem(message, code, LogLevels.ERROR));
        return this;
    }

    fatal(message: string, code: ErrorCode = ErrorCode.ERROR): OutputTree {
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

    add(logs: LogItem[]): OutputTree {
        for (let i = 0; i < logs.length; i++) {
            const item = logs[i];

            switch (item.logLevel) {
            case LogLevels.DEBUG:
                return this.debug(item.message);

            case LogLevels.INFO:
                return this.info(item.message);

            case LogLevels.WARNING:
                return this.warn(item.message, item.code);

            case LogLevels.ERROR:
                return this.error(item.message, item.code);

            case LogLevels.FATAL:
                return this.fatal(item.message, item.code);
            }
        }
        return this;
    }

    get(level: LogLevels): LogItem[] {
        return this.log.filter(item => {
            return item.logLevel === level;
        });
    }

    // collects errors from all children into a single collection
    flatten(level: LogLevels = LogLevels.DEBUG): { title: string, message: string, code: ErrorCode, level: LogLevels }[] {

        let items = this.log
            .filter((item) => {
                return item.logLevel >= level;
            })
            .map(e => {
                return {
                    title: this.title,
                    message: e.message,
                    code: e.code,
                    level: e.logLevel
                };
            });

        if (this.child) items = items.concat(this.child.flatten(level));
        return items;
    }

}

export class LogItem {
    constructor(public message: string, public code: ErrorCode = 0, public logLevel: LogLevels = LogLevels.INFO) { }
}

export enum ErrorCode {
    ERROR = 100,
    DATA_FILE_NOT_FOUND,
    SCHEMA_FILE_NOT_FOUND,
    SCHEMA_ERROR,
    INFLATION_ERROR,
    JWS_VERIFICATION_ERROR,
    QR_DECODE_ERROR,
    ISSUER_KEY_DOWNLOAD_ERROR,
    INVALID_SHC_STRING,
    NOT_IMPLEMENTED,
    UNKNOWN_FILE_DATA, // 110
    JSON_PARSE_ERROR,
    CRITICAL_DATA_MISSING,
    JWS_TOO_LONG,
    INVALID_FILE_EXTENSION
}

export enum InfoCode {
    INFO = 0
}

export class ErrorWithCode extends Error {
    constructor(message: string, public code: ErrorCode) {
        super(message);
    }
}

export class ResultWithErrors {
    public result: string | undefined = undefined;
    public errors: LogItem[] = [];

    error(message: string, code: ErrorCode, level = LogLevels.ERROR): ResultWithErrors {
        this.errors.push(new LogItem(message, code, level));
        return this;
    }
}
