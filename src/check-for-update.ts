// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import got from 'got';
import semver from 'semver';

export async function latestDevToolsVersion(): Promise<string | undefined> {
    try {
        const packageJson = await got('https://raw.githubusercontent.com/smart-on-fhir/health-cards-dev-tools/main/package.json').json() as {version: string};
        if (!packageJson || !packageJson.version) return;
        const v = semver.valid(packageJson.version);
        return v ? v : undefined;
    } catch {
        return;
    }
}

export async function latestSpecVersion(): Promise<string | undefined> {
    try {
        const SPEC_PREFIX_LENGTH = '# Changelog\n\n## '.length;
        const VERSION_LENGTH = 'v.v.v'.length;
        const body = await (await got('https://raw.githubusercontent.com/smart-on-fhir/health-cards/main/docs/changelog.md')).body;
        if (!body) return;
        const v = semver.valid(body.substring(SPEC_PREFIX_LENGTH, SPEC_PREFIX_LENGTH + VERSION_LENGTH));
        return v ? v : undefined;
} catch {
        return;
    }
}
