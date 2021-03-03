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

function generateAndStoreKey(outFileName: string, keyGenArgs: KeyGenerationArgs, omit?: string): void {
    const outFilePath = path.join(outdir, outFileName);
    if (!fs.existsSync(outFilePath)) {
        console.log("Generating " + outFilePath);
        const keystore = jose.JWK.createKeyStore();
        keystore.generate(keyGenArgs.kty, keyGenArgs.size, keyGenArgs.props)
            .then((key: JWK.Key) => {

                const isPrivateKey = false;
                const publicKeyJSON = key.toJSON(isPrivateKey);

                const stringIndexableKey = publicKeyJSON as JWK.Key & { [key: string]: string };
                if (omit && stringIndexableKey[omit]) {
                    delete stringIndexableKey[omit];
                }

                const publicKey = JSON.stringify(publicKeyJSON);
                fs.writeFileSync(outFilePath, publicKey);
            })
            .catch((error) => {
                throw error;
            });
    }
}


generateAndStoreKey('valid_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig' } });
generateAndStoreKey('wrong_kid_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig', kid: 'ThisIsNotTheThumbprintOfTheKey' } });
generateAndStoreKey('wrong_curve_key.json', { kty: 'EC', size: 'P-384', props: { alg: 'ES384', crv: 'P-384', use: 'sig' } });
generateAndStoreKey('wrong_use_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'enc' } });
generateAndStoreKey('wrong_alg_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256K', crv: 'P-256', use: 'sig' } });
generateAndStoreKey('wrong_kty_key.json', { kty: 'RSA', size: 2048 });
generateAndStoreKey('missing_kid_key.json', { kty: 'EC', size: 'P-256', props: { alg: 'ES256', crv: 'P-256', use: 'sig' } });


// TODO: generate files with missing algs, once omit is implemented