// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as jose from "node-jose";
import { toDataURL } from 'qrcode';
import { config } from "./config.js";

export async function encode(request: SHLLinkRequest): Promise<SHLEncoding> {

    const { passcode, payload, files, viewer } = request;
    const randomUrlSegment = payload?.path || randomBase64Url();
    const jwkKey = await createKey(payload?.key);
    const exportKey = (jwkKey.toJSON(true) as { k: string }).k;

    const jweFiles = await encodeFiles(files.map(f => JSON.stringify(f)), jwkKey);

    const url =  payload?.flag?.includes('U') ? `${config.SERVER_BASE}shl/${randomUrlSegment}` : `${config.SERVER_BASE}${randomUrlSegment}`;
  
    const respPayload: ShlinkPayload = {
        "url": url,
        "flag": `${payload?.flag?.includes('L') ? 'L' : ''}${payload?.flag?.includes('P') ? 'P' : payload?.flag?.includes('U') ? 'U' : ''}` as PayloadFlags,
        "key": exportKey,
        "label": payload?.label ?? "",
    }

    if (payload?.exp) {
        respPayload.exp = typeof payload.exp === 'string' ?
            new Date(payload.exp).getTime() / 1000.0 :
            payload.exp;
    }

    if (payload?.v) {
        respPayload.v = payload.v;
    }

    const link = `${viewer ?? ''}${viewer ? '#' : ''}shlink:/${Buffer.from(JSON.stringify(respPayload)).toString('base64url')}`;

    const qrcode = await toDataURL(link, { errorCorrectionLevel: 'Q' });

    return {
        link,
        passcode: passcode ?? '',
        attempts: request.attempts || config.DEFAULT_ATTEMPTS,
        randomUrlSegment,
        preserveFilePaths: !!request.filePaths?.length,
        filePaths: request.filePaths || [],
        payload: respPayload,
        jweFiles,
        qrcode
    };

}

async function createKey(key?: string): Promise<jose.JWK.Key> {
    let jwkKey;
    if (key) {
        jwkKey = await jose.JWK.asKey(Buffer.from(`{"kty":"oct","use":"enc","alg":"A256GCM","k":"${key}"}`, 'utf-8'));
    } else {
        const keystore = jose.JWK.createKeyStore();
        jwkKey = await keystore.generate('oct', 256, { alg: 'A256GCM', use: 'enc', });
    }
    return jwkKey;
}

async function encodeFiles(files: string[], jwkKey: jose.JWK.Key): Promise<JWE[]> {
    return await Promise.all(files.map((file) => (
        jose.JWE.createEncrypt({ format: 'compact' }, jwkKey)
            .update(Buffer.from(file, 'utf-8'))
            .final()
    )));
}

export function randomBase64Url(byteLength = 32): string {
    return Buffer.from(Buffer.alloc(byteLength).map(() => Math.floor(Math.random() * 256))).toString('base64url');
}
