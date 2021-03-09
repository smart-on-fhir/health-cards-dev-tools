// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fs from 'fs';
import path from 'path';
import jose, { JWK } from 'node-jose';
import svg2img from 'svg2img';
import Jimp from 'jimp';

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


function svgToImage(filePath: string): Promise<unknown> {

    const baseFileName = filePath.slice(0, filePath.lastIndexOf('.'));

    return new
        Promise<Buffer>((resolve, reject) => {
            svg2img(filePath, { width: 600, height: 600 },
                (error: unknown, buffer: Buffer) => {
                    error ? reject("Could not create image from svg") :  resolve(buffer);
                });
        })
        .then((buffer) => {
            fs.writeFileSync(baseFileName + '.png', buffer);
            return Jimp.read(baseFileName + '.png');            
        })
        .then(png => {
            return Promise.all([
                png.write(baseFileName + '.bmp'),
                png.grayscale().quality(100).write(baseFileName + '.jpg')
            ]);
        })
        .catch(err => { console.error(err); });
}


async function generateImagesFromSvg(dir: string) {

    const files = fs.readdirSync(dir);

    for (let i = 0; i < files.length; i++) {
        const file = path.join(dir, files[i]);
        if (path.extname(file) === '.svg') {
            await svgToImage(file);
        }
    }
}



// TODO: generate files with missing algs, once omit is implemented

void generateImagesFromSvg(outdir);
