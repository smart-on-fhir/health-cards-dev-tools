// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

type JWE = string;
type JWS = string;

interface VerifiableCredential {
    verifiableCredential: JWS[];
}

type ShlinkContentType = "application/smart-health-card" | "application/smart-api-access" | "application/fhir+json";

interface ShlinkManifest {
    files: ShlinkFile[];
}

interface ShlinkFile {
    contentType: ShlinkContentType;
    embedded?: string;
    location?: string;
}

interface ShlinkManifestRequest {
    url: string,
    recipient: string;
    passcode?: string;
    embeddedLengthMax?: number;
}

interface ShlinkPayload {
    url: string;
    key: string;
    exp?: number;
    flag?: "L" | "P" | "LP";
    label?: string;
    v?: number;
}

interface SHLEncoding {
    link: string,
    passcode: string,
    attempts: number,
    randomUrlSegment: string,
    preserveFilePaths: boolean,
    filePaths: string[],
    payload: ShlinkPayload,
    jweFiles: string[],
    qrcode: string;
}

type SHLStore = Record<string, SHLEncoding>;

interface SHLLinkRequest {
    passcode?: string;
    viewer?: string;
    attempts?: number;
    filePaths?: string[];
    payload?: {
        path?: string;
        key?: string;
        exp?: number | string;
        flag?: "L" | "P" | "LP";
        label?: string;
        v?: number;
    };
    files: { verifiableCredential: JWS[] }[];
}