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
    FHIR_SCHEMA_ERROR,
    INFLATION_ERROR,
    JWS_HEADER_ERROR,
    JWS_VERIFICATION_ERROR,
    SIGNATURE_FORMAT_ERROR,
    QR_DECODE_ERROR, // fatal
    ISSUER_KEY_DOWNLOAD_ERROR,
    ISSUER_KEY_WELLKNOWN_ENDPOINT_CORS,
    ISSUER_NOT_TRUSTED,
    ISSUER_DIRECTORY_NOT_FOUND,
    ISSUER_KID_MISMATCH,
    INVALID_ISSUER_URL,
    INVALID_QR,
    INVALID_NUMERIC_QR,
    INVALID_NUMERIC_QR_HEADER,
    MISSING_QR_CHUNK, // fatal
    UNBALANCED_QR_CHUNKS,
    INVALID_QR_VERSION,
    UNKNOWN_FILE_DATA,
    JSON_PARSE_ERROR,

    JWS_TOO_LONG,
    INVALID_FILE_EXTENSION,
    TRAILING_CHARACTERS,
    NOT_YET_VALID,
    PROFILE_ERROR,
    
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
    OPENSSL_NOT_AVAILABLE = 300,

    // FHIR-validator
    FHIR_VALIDATOR_ERROR = 400
}

class ExcludableError {
    constructor(public error: string, public code: number[]) { }
}

// maps error strings to error codes
// note: we currently only make certain errors excludable (e.g., those common in development)
export const ExcludableErrors: ExcludableError[] = [
    new ExcludableError('openssl-not-available', [ErrorCode.OPENSSL_NOT_AVAILABLE]),
    new ExcludableError('invalid-issuer-url', [ErrorCode.INVALID_ISSUER_URL]),
    new ExcludableError('invalid-key-x5c', [ErrorCode.INVALID_KEY_X5C]),
    new ExcludableError('invalid-key-wrong-kty', [ErrorCode.INVALID_KEY_WRONG_KTY]),
    new ExcludableError('invalid-key-wrong-alg', [ErrorCode.INVALID_KEY_WRONG_ALG]),
    new ExcludableError('invalid-key-wrong-use', [ErrorCode.INVALID_KEY_WRONG_USE]),
    new ExcludableError('invalid-key-wrong-kid', [ErrorCode.INVALID_KEY_WRONG_KID]),
    new ExcludableError('invalid-key-schema', [ErrorCode.INVALID_KEY_SCHEMA]),
    new ExcludableError('not-yet-valid', [ErrorCode.NOT_YET_VALID]),
    new ExcludableError('fhir-schema-error', [ErrorCode.FHIR_SCHEMA_ERROR]),
    new ExcludableError('issuer-key-download-error', [ErrorCode.ISSUER_KEY_DOWNLOAD_ERROR]),
    new ExcludableError('unbalanced-qr-chunks', [ErrorCode.UNBALANCED_QR_CHUNKS]),
    new ExcludableError('jws-too-long', [ErrorCode.JWS_TOO_LONG]),
    new ExcludableError('invalid-file-extension', [ErrorCode.INVALID_FILE_EXTENSION]),
    new ExcludableError('trailing-characters', [ErrorCode.TRAILING_CHARACTERS]),
    new ExcludableError('issuer-wellknown-endpoint-cors', [ErrorCode.ISSUER_KEY_WELLKNOWN_ENDPOINT_CORS])
]

export function getExcludeErrorCodes(errors: string[]): Set<ErrorCode> {
    const errorCodes: Set<ErrorCode> = new Set<ErrorCode>();
    const invalidErrors: Set<string> = new Set<string>();
    for (const error of errors) {
        for (const excludableError of ExcludableErrors) {
            try {
                if (excludableError.error === error || new RegExp('^' + error.replace('*','.*') + '$').test(excludableError.error))
                {
                    excludableError.code.map(e => errorCodes.add(e));
                }
            } catch {
                invalidErrors.add(error);
            }
        }
    }
    if (invalidErrors.size > 0) {
        console.log("Invalid exclusion error strings: ", Array.from(invalidErrors));
    }
    return errorCodes;
}