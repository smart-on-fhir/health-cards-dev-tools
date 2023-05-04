// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// ----------------------------------------------------------------------
// Simple test server for SMART Health Link operations
// This code is for illustration purposes only, it shouldn't be used in 
// productions. 
// ----------------------------------------------------------------------

import express from 'express';
import { config } from './config.js';
import http from 'http';
import { encode, randomBase64Url } from './encode.js'
import * as store from './store.js';



const app = express();
app.use(express.json())
app.use(express.static('./public'))
app.use(express.urlencoded({ extended: true }))


//
// Request new SMART Health Link
//
app.post(config.CREATE_LINK, (req, res) => {
    console.log('Received Request to create new SHL', config.CREATE_LINK, req.body);

    const request = req.body as SHLLinkRequest;

    if (!verifyRequest(request)) {
        res.status(400).send("Bad Request");
        return;
    }

    void encode(request)
        .then((entry) => {
            store.update(entry);
            res.type('text');
            res.send(entry.link);
        });

    });


//
// Request for manifest file
//
app.get('/shl/*', (req, res) => {
    console.log('Received Request for Manifest File', '/shl/*', req.body);

    const urlWithoutQuery = req.url.split('?')[0];
    const url = urlWithoutQuery.split('/')[2];
    const file = store.file(url);

    if (!file) {
        res.status(404).send("Not found.");
        return;
    }

    res.type('text');
    res.send(file);
});


//
// Request for manifest
//
app.post('/*', (req, res) => {
    console.log('Received Request for Manifest', '/*', req.body);

    const params= req.body as ShlinkManifestRequest;
    const url = req.url.split('/')[1];
    const entry = store.lookup(url) // shlStore[url];

    if (!entry || entry.attempts === 0) {
        res.status(404).send("SHLink is invalid or no longer active");
        return;
    }

    const requiresPasscode = (entry.payload.flag ?? '').indexOf('P') >= 0;
    if (requiresPasscode) {
        if (!params.passcode || (params.passcode !== entry.passcode)) {
            entry.attempts -= 1;
            res.status(401).send({
                remainingAttempts: entry.attempts
            });
            store.update(entry);
            return;
        }
    }

    const manifest: ShlinkManifest = {
        files: []
    }

    entry.jweFiles.forEach((f, i) => {

        const randFileSegment = entry.preserveFilePaths ? entry.filePaths[i] : randomBase64Url();
        entry.filePaths[i] = randFileSegment;

        const file: ShlinkFile = {
            "contentType": "application/smart-health-card",
            "location": `${config.SERVER_BASE}shl/${randFileSegment}`
        };

        if (params.embeddedLengthMax ?? 0 >= entry.jweFiles[i].length) {
            file.embedded = entry.jweFiles[i];
        }

        manifest.files.push(file);
    });

    // update saved file
    store.update(entry);

    res.type('json');
    res.send(manifest);
});

const server = http.createServer(app);
server.listen(config.SERVICE_PORT, () => {
    const url = config.SERVER_BASE;
    console.log([
        `SHL HTTP test server listening at ${url}`
    ].join('\n'));
    process.exitCode = 0;
});



function verifyRequest(request: SHLLinkRequest): boolean {

    if (!isObject(request)) return false;

    const { passcode, viewer, payload, attempts, files } = request;

    if (passcode && typeof passcode !== 'string') return false;

    if (payload && !isObject(payload)) return false;

    if (!files ||
        !(files instanceof Array) ||
        !files.every(element =>
            element.verifiableCredential &&
            element.verifiableCredential instanceof Array &&
            element.verifiableCredential.every((vc: unknown) => typeof vc === 'string')
        )
    ) return false;

    if (!payload) return true;

    const { path, key, exp, flag, label, v } = payload;

    if (path && typeof path !== 'string') return false;

    if (key && typeof key !== 'string') return false;

    if (exp && (typeof exp !== 'string' && typeof exp !== 'number')) return false;

    if (flag && !['L', 'LP', 'P', 'U', 'LU'].includes(flag)) return false;

    if (label && typeof label !== 'string') return false;

    if (viewer && typeof viewer !== 'string') return false;

    if (v && typeof v !== 'number') return false;

    if (attempts && typeof attempts !== 'number') return false;

    return true;

}

function isObject(object: unknown): boolean {
    return Object.prototype.toString.call(object) === '[object Object]';
}
