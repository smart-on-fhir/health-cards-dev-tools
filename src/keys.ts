// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { JWK } from "node-jose";
import * as utils from './utils';

export type KeySet = {
    keys : JWK.Key[]
}

export let store = JWK.createKeyStore();

export async function initKeyStoreFromFile(filePath: string): Promise<JWK.KeyStore> {

    const keySet = utils.loadJSONFromFile<JWK.Key[]>(filePath);

    store = await JWK.asKeyStore(keySet);

    return store;
}

// export function importKeySet(keySet :  keySet, log : Log) : void {




//     // failures will be recorded in the log. we can continue processing.
//     validateSchema(keySetSchema, keySet, log);


//     for (let i = 0; i < keySet.keys.length; i++) {

//         let key: JWK.Key = keySet.keys[i];

//         log.info('Validating key : ' + key.kid || i.toString());

//         try {
//             key = await keyStore.add(key);
//         } catch (error) {
//             log.error('Error adding key to keyStore : ' + (error as Error).message, ErrorCode.INVALID_UNKNOWN);
//             return new ValidationResult(undefined, log);
//         }

// }

