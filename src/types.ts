// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-unused-vars */
type JWS = string;

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
    | "shlmanifest";

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
    flag?: "L" | "P" | "LP";
    label?: string;
}

interface ShlinkManifestFile {
    files: ShlinkFile[];
}

type ShlinkContentType = "application/smart-health-card" | "application/smart-api-access" | "application/fhir+json";

interface ShlinkFile {
    contentType: ShlinkContentType;
    embedded?: string;
    location?: string;
}

interface ShlinkManifestRequest {
    recipient: string;
    passcode?: string;
    embeddedLengthMax?: number;
}
