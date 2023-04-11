// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { config } from "./config.js";
import fs from 'fs';

const shlStore: SHLStore = {};

//
// Load links/files from filesystem if PERSIST_LINKS is true
//
function initStore() {
    if (!config.PERSIST_LINKS) return;
    const fileNames = fs.readdirSync('./shl');
    fileNames.forEach(f => {
        let entry;
        const path = `./shl/${f}`;
        try {
            const text = fs.readFileSync(path).toString('utf-8')
            entry = JSON.parse(text) as SHLEncoding;
        } catch {
            console.error(`Could not parse file ${path}. Deleting.`);
            fs.rmSync(path);
            return;
        }
        shlStore[entry.randomUrlSegment] = entry;
    });
}

//
// Looks up an entry by id (random base64url string)
//
export function lookup(id: string): SHLEncoding | undefined {
    return shlStore[id];
}

//
// Stores an entry and persists to the file system if PERSIST_LINKS=true
//
export function update(entry: SHLEncoding): void {
    shlStore[entry.randomUrlSegment] = entry;
    if (!config.PERSIST_LINKS) return;
    const filePath = `./shl/${entry.randomUrlSegment}.json`;
    fs.writeFile(filePath, JSON.stringify(entry, null, 4), () => {
        console.debug(`${filePath} updated`);
    });
}

//
// Looks up a file by id (random base64url string)
//
export function file(id: string): JWE | undefined {
    const entry = Object.values(shlStore).find(entry => entry.filePaths.find(s => s === id));
    if (!entry) return undefined;
    return entry.jweFiles[entry.filePaths.indexOf(id)];
}

initStore(); 
