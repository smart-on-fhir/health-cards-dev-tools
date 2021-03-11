// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import jose, { JWK } from 'node-jose';


interface KeyGenerationArgs {
    kty: string;
    size?: string | number;
    props?: { alg: string, crv?: string, use: string, kid?: string }
}
const outdir = 'testdata';

async function generateAndStoreKey(outFileName: string, keyGenArgs: KeyGenerationArgs, count = 1, isPrivate = false, omit = ''): Promise<void> {
    const outFilePath = path.join(outdir, outFileName);
    if (!fs.existsSync(outFilePath)) {
        console.log("Generating " + outFilePath);
        const keystore = jose.JWK.createKeyStore();
        for (let i = 0; i < count; i++) {
            await keystore.generate(keyGenArgs.kty, keyGenArgs.size, keyGenArgs.props);
        }
        const jwkSet = keystore.toJSON(isPrivate);
        if (omit) {
            // TODO: delete this property
        }
        fs.writeFileSync(outFilePath, JSON.stringify(jwkSet));
    }
}
generateAndStoreKey('valid_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig' } });
generateAndStoreKey('private_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig' }}, 1, true);
generateAndStoreKey('valid_keys.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig' } }, 3);
generateAndStoreKey('wrong_kid_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig', kid: 'ThisIsNotTheThumbprintOfTheKey' } });
generateAndStoreKey('wrong_curve_key.json', { kty: 'EC', size: 'P-384', props: { alg: 'ES384', crv: 'P-384', use: 'sig' } });
generateAndStoreKey('wrong_use_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'enc' } });
generateAndStoreKey('wrong_alg_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256K', crv: 'P-256', use: 'sig' } });
generateAndStoreKey('wrong_kty_key.json', { kty: 'RSA', size: 2048 });

