// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as jose from "node-jose";
import { qrCode } from "./utils";

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


// void (async () => {

//     const result = await encode([
//         '{"verifiableCredential":["eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.pZJJT8MwEIX_ChquaZZSthyBAxwQSCwX1IPrTBsjL9HYKRSU_85MaAVCiAtSDnH85vN7z3kHEyPU0KbUxbooYoc6j05RalHZ1OZaURMLfFWusxgLVvdIkIFfLKGujman5bQ8mM7y6dFhBmsN9TukTYdQP30xf-L2PxcTWTDq_zrjXO_Nm0omeJhnoAkb9Mkoe9cvnlEnsbVsDT0iRdHUMMvLvGKofD3rfWNRNIQx9KTxfowA241sGwl0sJZpQsiAD6AN52Ryb-0DWRbs5uuSBbvFL-Bbtsrz0qNy-AlRztiNHErhRfgrs0YvPd5YfiOYD5xsYTj6hUoCmZbV8aSsJuUMhiH71Ub1t42r771lEJNKfRxzym0nlNbXSmvj8Tw0I0GHxvjV6DhuYkK3_Xn4Xlp7nAdaFVJpEU1T6PUrA_Q4CeUJDPMhg24bfXSzREIv1r43x6KgdU_jlmS9N-5HXsYgLQM57kWsKJ0CCbIxsbNKarxGMglp7zLEziRluaP5-AzDBw.xOwN6qSTeHU-FkqTIojbvryr8Ztue_HBbiiGdIcfio7m2-STuC-CdNIEt9WbxU_CpveZwdwdYlaQ3cX-yi-SQg"]}',
//         '{"verifiableCredential":["eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.pZJLb9swEIT_SrC9ynrYSozq2PaQnBIgjx4KH2hqbbHgQ1hSbtxA_727jIMERZBLAB1EcvhxZsgnMDFCB0NKY-yqKo6oy-gUpQGVTUOpFfWxwkflRouxYvWEBAX47Q665qL9Wi_r1bItl-tVAQcN3ROk44jQ_Xpl_o_78jxYyIBRn9cZ5yZv_qpkgodNAZqwR5-MsrfT9jfqJLZ2g6EHpCiaDtqyLhuGyuy3yfcWRUMYw0Qa73IEOC0Up0igg7VME0IBfAAdOSeTJ2vvybLgZX9Xs-Bl8A74hq3yfulROXyGKGfsUQ6l8Ef4e3NALz1eW_4j2MycbGs4-g-VBLKsm_WibhZ1C_NcvGuj-djG1dveCohJpSnmnHLbCaX1g9LaePwe-kzQoTd-nx3HY0zoTo-H72Ww6zLQvpJKq2j6Sh8eGaDzTmjaC5g3cwHjKXu2s0NCL97eVseioPVEeUnC3hn3Gni1qM8ZOyLtAjkuRrwonQIJsjdxtEp6vP95dpkfydkN9kYlMpp72uRvnv8B.xMOa6WDbATD-kxUeCwPWFPOOy9vjERhr674vxlnganYP7LVgdLbyt4vyZzpimh-5Uxn-AZs5GuuXvbIq3wPyJg"]}',
//         '{"verifiableCredential":["eyJ6aXAiOiJERUYiLCJhbGciOiJFUzI1NiIsImtpZCI6IjNLZmRnLVh3UC03Z1h5eXd0VWZVQUR3QnVtRE9QS01ReC1pRUxMMTFXOXMifQ.pZJLT-MwFIX_Crps0zxKoSJLmMWwAmlgZoG6cJ3bxsiP6Nrp0EH573OvKSpCiA1SFrF9_PmcY7-AiRFa6FMaYltVcUBdRqco9ahs6kutqIsVPis3WIwVq0ckKMCvN9A2F4vLel6fzRflfHlewE5D-wJpPyC0j0fmR9zp62AmA0Z9X2ecG735p5IJHlYFaMIOfTLK_hrXT6iT2Nr0hn4jRdG0sCjrsmGozF6NvrMoGsIYRtJ4nyPAYaE4RAIdrGWaEArgA2jPOZk8WvtAlgVv-9uaBW-DT8B3bJX3S4_K4StEOWP3ciiFv8Lfmh166fHW8h_BauJka8PRf6gkkHndLGd1M6sXME3Fpzaar23cvO-tgJhUGmPOKbedUFrfKa2Nx-vQZYIOnfHb7DjuY0J3eDx8L71dloG2lVRaRdNVevfMAJ13QtNcwLSaChgO2bOdDRJ68fa-OhYFrUfKSxL23rhj4LNZfc7YAWkTyHEx4kXpFEiQnYmDVdLjw5-Tn_mRnNxhZ1Qio7mnVf6m6T8.UZWZ7OXFBmY40JsLMUZtg059cvBag6roSZt37MVYE85MHcISjKltbsTOk7AX-tnJs4r_oEPuTpLaIRL8yuhBjQ"]}'
//     ], '', "1234", 1897171200);

//     console.log(JSON.stringify(result, null, 2));

//     await qrCode(
//         "./testdata/shlink-qr.png",
//         result.link,
//         "Q");

// })();
