// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import got from 'got';
import { rejects } from 'node:assert';

export const CHECK_FOR_UPDATE_ERROR = 'error';

export interface Version {
    major: number;
    minor: number;
    patch: number;
    str: string;
}

// returns:
//    -1 if vA < vB
//     0 if vA = vB
//     1 if vA > vB
export function compareVersions(vA: Version, vB: Version): number {
    if (vA.major > vB.major) {
        return 1;
    } else if (vA.major === vB.major) {
        if (vA.minor > vB.minor) {
            return 1;
        } else if (vA.minor === vB.minor) {
            if (vA.patch > vB.major) {
                return 1;
            } else if (vA.patch === vB.patch) {
                return 0;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    } else {
        return -1;
    }
}

export const stringToVersion = (vStr: string): Version | undefined => {
    if (!vStr) return;
    const v = vStr.split('.');
    if (!v || v.length != 3) return;
    return {
        major: parseInt(v[0]),
        minor: parseInt(v[1]),
        patch: parseInt(v[2]),
        str: vStr
    }
}

export async function latestSdkVersion(): Promise<Version | undefined> {
    try {
        const packageJson = await got('https://raw.githubusercontent.com/microsoft/health-cards-validation-SDK/main/package.json').json() as {version: string};
        if (!packageJson || !packageJson.version) return;
        return stringToVersion(packageJson.version);
    } catch {
        return;
    }
}

export async function latestSpecVersion(): Promise<Version | undefined> {
    try {
        const SPEC_PREFIX_LENGHT = '# Changelog\n\n## '.length;
        const VERSION_LENGTH = 'v.v.v'.length;
        const body = await (await got('https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/docs/changelog.md')).body;
        if (!body) return;
        return stringToVersion(body.substring(SPEC_PREFIX_LENGHT, SPEC_PREFIX_LENGHT + VERSION_LENGTH));
} catch {
        return;
    }
}
