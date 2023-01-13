// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as jose from "node-jose";

interface SHLEncoding {
    link: string,
    payload: ShlinkPayload,
    manifest: ShlinkManifest,
    files: string[]
}


export async function encode(
    files: string[] = [],
    key = '',
    passcode = '',
    expiration = Date.now(),
    viewer = '',
    label = '',
    baseUrl = 'https://test-link',
    baseLocation = 'https://api.vaxx.link/api/shl'): Promise<SHLEncoding> {

    // generate random path for files

    const randomUrlSegment = Buffer.from(Buffer.alloc(32).map(() => Math.floor(Math.random() * 256))).toString('base64url');
    const randomLocationSegment = Buffer.from(Buffer.alloc(32).map(() => Math.floor(Math.random() * 256))).toString('base64url');

    const keystore = jose.JWK.createKeyStore();

    const jwkKey = key ?
        await keystore.add({
            alg: "A256GCM",
            ext: true,
            k: key,
            key_ops: ["encrypt"],
            kty: "oct",
        }) :
        await keystore.generate('oct', 256, { alg: 'A256GCM', use: 'enc', });

    const exportKey = (jwkKey.toJSON(true) as { k: string }).k;

    // create each file
    const manifest: ShlinkManifest = {
        files: await Promise.all(files.map(async (file, i) => {
            const jwe = await jose.JWE.createEncrypt({ format: 'compact' }, jwkKey)
                .update(Buffer.from(file, 'utf-8'))
                .final();
            return {
                "contentType": "application/smart-health-card",
                "embedded": jwe,
                "location": `${baseLocation}/${randomLocationSegment}/file/${i}`
            }
        }))
    };

    const payload: ShlinkPayload = {
        "url": `${baseUrl}/${randomUrlSegment}`,
        "flag": `${expiration ? '' : 'L'}${passcode ? "P" : ""}` as "L" | "P" | "LP",
        "key": exportKey,
        "label": label,
        "exp": expiration
    }

    const link = `${viewer}${viewer ? '#' : ''}shlink:/${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;


    return {
        link,
        payload,
        manifest,
        files
    };

}
