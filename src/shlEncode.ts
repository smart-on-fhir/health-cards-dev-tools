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

void (async () => {
    const shl = await encode(
        [
            JSON.stringify({
                "verifiableCredential": [
                    "eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.3ZJLj9MwFIX_yuiyzcNJmXaSHS0SL4FAM8MGdeE6t42RY0e2E7WM8t-5djsaQNPZABIiuxsfH5_z2XcgnYMaWu97V-e561FkruPWt8iVbzPBbeNy3POuV-hyUg9oIQG92UJdzOczVrDZVZHNq6sERgH1HfhDj1B_efD81e7ZcUjDQFbndbLrBi2_cS-NflIozCibooJ1AsJig9pLrq6HzVcUPkTattJ-RuuCTw3PM5YV5Bf-LgfdKAwai84MVuBNjA-nheRUB4RRityOSegAe6CO5DwodWsVCe7314wE98Mjxh-pDu0PDHmHRxPeSUV-8EKTxrp4xk6OqAPHt6YN8zKD9UQFN5LKv-Q-eBXVZZGyIi0ZTFPyaJri6TRvfkbsPPeDi3XDhXsMFzRyIaTGlWmigzCN1LsY3B2cx-70fuhmWrXIjN3lgWzuZJOLcU8GIu6Eki1gWk8J9CcEMc4WLeqQ7UeCJDJCDDYuhbI3sjtalLEwC7UI1dbYjt5jyMKFNzZYNtL1ikecy9XFK9Roubp4bVwvPVcEiiAq4z8M3SZsBRa_4izB8r8kWFZ_muDiLMHZP0SQev8-wTJlVcou_8YbXBNEsLKhn-_fHVb7dtHPh0-08B0.kpV4IAUIXf5jI0ETA3JbVraT0g5-Pkq5DAC3TzihwnVJbYd2nt0u0wvhygIQXg8Gnz4X1r-Q34tTvrifp4v_Sg"
                ]
            }),
            JSON.stringify({
                "verifiableCredential": [
                    "eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.3ZJLj9MwFIX_yuiyzcNJmXaSHS0SL4FAM8MGdeE6t42RY0e2E7WM8t-5djsaQNPZABIiuxsfH5_z2XcgnYMaWu97V-e561FkruPWt8iVbzPBbeNy3POuV-hyUg9oIQG92UJdzOczVrDZVZHNq6sERgH1HfhDj1B_efD81e7ZcUjDQFbndbLrBi2_cS-NflIozCibooJ1AsJig9pLrq6HzVcUPkTattJ-RuuCTw3PM5YV5Bf-LgfdKAwai84MVuBNjA-nheRUB4RRityOSegAe6CO5DwodWsVCe7314wE98Mjxh-pDu0PDHmHRxPeSUV-8EKTxrp4xk6OqAPHt6YN8zKD9UQFN5LKv-Q-eBXVZZGyIi0ZTFPyaJri6TRvfkbsPPeDi3XDhXsMFzRyIaTGlWmigzCN1LsY3B2cx-70fuhmWrXIjN3lgWzuZJOLcU8GIu6Eki1gWk8J9CcEMc4WLeqQ7UeCJDJCDDYuhbI3sjtalLEwC7UI1dbYjt5jyMKFNzZYNtL1ikecy9XFK9Roubp4bVwvPVcEiiAq4z8M3SZsBRa_4izB8r8kWFZ_muDiLMHZP0SQev8-wTJlVcou_8YbXBNEsLKhn-_fHVb7dtHPh0-08B0.kpV4IAUIXf5jI0ETA3JbVraT0g5-Pkq5DAC3TzihwnVJbYd2nt0u0wvhygIQXg8Gnz4X1r-Q34tTvrifp4v_Sg"
                ]
            }),
            JSON.stringify({
                "verifiableCredential": [
                    "eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.3ZJLj9MwFIX_yuiyzcNJmXaSHS0SL4FAM8MGdeE6t42RY0e2E7WM8t-5djsaQNPZABIiuxsfH5_z2XcgnYMaWu97V-e561FkruPWt8iVbzPBbeNy3POuV-hyUg9oIQG92UJdzOczVrDZVZHNq6sERgH1HfhDj1B_efD81e7ZcUjDQFbndbLrBi2_cS-NflIozCibooJ1AsJig9pLrq6HzVcUPkTattJ-RuuCTw3PM5YV5Bf-LgfdKAwai84MVuBNjA-nheRUB4RRityOSegAe6CO5DwodWsVCe7314wE98Mjxh-pDu0PDHmHRxPeSUV-8EKTxrp4xk6OqAPHt6YN8zKD9UQFN5LKv-Q-eBXVZZGyIi0ZTFPyaJri6TRvfkbsPPeDi3XDhXsMFzRyIaTGlWmigzCN1LsY3B2cx-70fuhmWrXIjN3lgWzuZJOLcU8GIu6Eki1gWk8J9CcEMc4WLeqQ7UeCJDJCDDYuhbI3sjtalLEwC7UI1dbYjt5jyMKFNzZYNtL1ikecy9XFK9Roubp4bVwvPVcEiiAq4z8M3SZsBRa_4izB8r8kWFZ_muDiLMHZP0SQev8-wTJlVcou_8YbXBNEsLKhn-_fHVb7dtHPh0-08B0.kpV4IAUIXf5jI0ETA3JbVraT0g5-Pkq5DAC3TzihwnVJbYd2nt0u0wvhygIQXg8Gnz4X1r-Q34tTvrifp4v_Sg"
                ]
            }),
        ],
        '',
        '1234',
        Math.floor(Date.now() / 1000) + 365 * 60 * 60,
        'https://viewer.example.org',
        'Test',
        'https://test-link',
        'https://api.vaxx.link/api/shl');

    console.log(JSON.stringify(shl, null, 2));
})()
