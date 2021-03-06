// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/* eslint-disable @typescript-eslint/no-unused-vars */
type JWS = string;

interface HealthCard {
    "verifiableCredential": JWS[]
}

interface JWSPayload {
    "iss": string,
    "iat": number,
    "vc": {
        credentialSubject: {
            fhirBundle: FhirBundle
        }
    }
}
interface FhirBundle {
    "resourceType": string,
    "type": string,
    "entry": unknown[]
}
