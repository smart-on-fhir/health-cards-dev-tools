// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-unused-vars */
type JWS = string;

type JWE = string;

type SHC = string;

type ValidationType =
    | "qr"
    | "qrnumeric"
    | "healthcard"
    | "fhirhealthcard"
    | "jws"
    | "jwspayload"
    | "fhirbundle"
    | "jwkset"
    | "shlink"
    | "shlpayload"
    | "shlmanifest"
    | "shlfile";

type PayloadFlags = "L" | "P" | "LP" | "U" | "LU";

interface HealthCard {
    verifiableCredential: JWS[];
}

// SMART Health Cards response payload format as returned from a FHIR $health-cards-issue request
interface FhirHealthCardItem {
    name: string;
    valueString?: JWS;
}

interface FhirHealthCard {
    resourceType: string;
    parameter: FhirHealthCardItem[];
}

interface JWEHeader {
    alg: string;
    enc: string;
    contentType: string;
}

interface JWSPayload {
    iss: string;
    nbf: number;
    exp?: number;
    vc: {
        type: string[];
        credentialSubject: {
            fhirBundle: FhirBundle;
        };
        rid?: string;
    };
}
interface FhirBundle {
    text: string;
    Coding: { display: unknown };
    CodeableConcept: { text: unknown };
    meta: unknown;
    id: unknown;
    resourceType: string;
    type: string;
    entry: BundleEntry[];
}

type Resource = { resourceType: string; meta?: { security?: unknown[] } } & Record<string, unknown>;

interface BundleEntry {
    id?: string;
    extension?: unknown[];
    modifierExtension?: unknown[];
    link?: string[];
    fullUrl?: string;
    resource: Resource;
    search?: unknown;
    request?: unknown;
    response?: unknown;
}

interface Schema {
    $schema?: string;
    $id?: string;
    description?: string;
    discriminator?: {
        propertyName: string;
        mapping: Record<string, string>;
    };
    oneOf?: { $ref: string }[];
    definitions: Record<string, SchemaProperty>;
}

interface SchemaProperty {
    properties?: Record<string, SchemaProperty>;
    items?: { $ref: string } | { enum: string[] }; // SchemaProperty (more general)
    oneOf?: { $ref: string }[]; //SchemaProperty[] (more general)
    pattern?: string;
    type?: string;
    description?: string;
    $ref?: string;
    additionalProperties?: boolean;
    enum?: string[];
    const?: string;
}

interface CommandResult {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
}

interface ShlinkPayload {
    url: string;
    key: string;
    exp?: number;
    flag?: PayloadFlags;
    label?: string;
}

interface ShlinkManifest {
    files: ShlinkFile[];
}

type ShlinkContentType = "application/smart-health-card" | "application/smart-api-access" | "application/fhir+json";

interface ShlinkFile {
    contentType: ShlinkContentType;
    embedded?: string;
    location?: string;
}

interface ShlinkManifestRequest {
    url: string;
    recipient: string;
    passcode?: string;
    embeddedLengthMax?: number;
}

interface ShlinkFileDirect {
    url: string;
    recipient: string;
}
