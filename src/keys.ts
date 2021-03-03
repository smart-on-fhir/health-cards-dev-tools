// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { JWK } from "node-jose";
import * as utils from './utils';

export let store = JWK.createKeyStore();

export async function initKeyStoreFromFile(filePath: string): Promise<JWK.KeyStore> {

    const keySet = utils.loadJSONFromFile<JWK.Key[]>(filePath);

    store = await JWK.asKeyStore(keySet);

    return store;
}

