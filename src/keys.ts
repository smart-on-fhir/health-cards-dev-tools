// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { JWK } from "node-jose";


// 1-to-many mapping of Issuer URL to key-ids (kid)
// keyMap = { 'https://spec.smarthealth.cards/examples/issuer' : { "ARrigjsh8mTqaVdihxO5cxkaRjpjXUg8ARET6IzhvaQ" : 1, <kid> }) 
let keyMap: Record<string, Record<string, number>> = {};


const keyStore = {
    add: add,
    clear: clear,
    check: check,
    get: get,
    store: JWK.createKeyStore()
}


function get(kid: string): JWK.RawKey {
    return keyStore.store.get(kid)
}


function check(kid: string, issuer: string): boolean {
    return !!keyMap[issuer]?.[kid];
}


async function add(key: JWK.Key, issuer?: string): Promise<JWK.Key> {

    const keyOut : JWK.Key = await keyStore.store.add(key);

    if (issuer) {
        keyMap[issuer] = keyMap[issuer] || {};
        keyMap[issuer][key.kid] = keyMap[issuer][key.kid] || 1;
    }

    return keyOut;
}


function clear(): void {
    keyStore.store = JWK.createKeyStore();
    keyMap = {};
    // To Delete the keys out of the store without blowing it away.
    // const p: Promise<JWK.Key>[] = [];
    // internalStore.all().forEach(rawKey => p.push(JWK.asKey(rawKey)));
    // return Promise.all(p)
    //     .then(keys => keys.forEach(key => internalStore.remove(key)));
}


export type KeySet = {
    keys: JWK.Key[]
}


export default keyStore;