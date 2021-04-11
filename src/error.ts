// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export enum ErrorCode {
    // misc errors
    ERROR = 100,

    DATA_FILE_NOT_FOUND, // fatal
    LOG_PATH_NOT_FOUND, // fatal
    CRITICAL_DATA_MISSING, // fatal

    // card errors
    SCHEMA_ERROR,
    INFLATION_ERROR,
    JWS_VERIFICATION_ERROR,
    SIGNATURE_FORMAT_ERROR,
    QR_DECODE_ERROR, // fatal
    ISSUER_KEY_DOWNLOAD_ERROR,
    INVALID_ISSUER_URL,
    INVALID_NUMERIC_QR,
    INVALID_NUMERIC_QR_HEADER,
    MISSING_QR_CHUNK, // fatal
    UNBALANCED_QR_CHUNKS,
    UNKNOWN_FILE_DATA,
    JSON_PARSE_ERROR,

    JWS_TOO_LONG,
    INVALID_FILE_EXTENSION,
    TRAILING_CHARACTERS,
    
    // key errors
    INVALID_KEY_WRONG_KTY = 200,
    INVALID_KEY_WRONG_ALG,
    INVALID_KEY_WRONG_USE,
    INVALID_KEY_WRONG_KID,
    INVALID_KEY_SCHEMA,
    INVALID_KEY_PRIVATE,
    INVALID_KEY_X5C,
    INVALID_KEY_UNKNOWN,

    // config errors
    OPENSSL_NOT_AVAILABLE = 300
}

class ExcludableError {
    constructor(public error: string, public code: number[]) { }
}

// maps error strings to error codes
// TODO: should we make all errors excludable, or only ones known to cause problems in dev
export const ExcludableErrors: ExcludableError[] = [
    new ExcludableError('openssl-not-available', [ErrorCode.OPENSSL_NOT_AVAILABLE]),
    new ExcludableError('invalid-issuer-url', [ErrorCode.INVALID_ISSUER_URL]),
    new ExcludableError('invalid-key-x5c', [ErrorCode.INVALID_KEY_X5C])
]

export function getExcludeErrorCodes(errors: string[]): Set<ErrorCode> {
    let errorCodes: Set<ErrorCode> = new Set<ErrorCode>();
    for (let error of errors) {
        for (let excludableError of ExcludableErrors) {
            if (excludableError.error === error) // TODO: regex match 
            {
                excludableError.code.map(e => errorCodes.add(e));
            }
        }
    }
    return errorCodes;
}