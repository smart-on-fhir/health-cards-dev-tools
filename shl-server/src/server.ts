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
import fs from 'fs';


const app = express();
app.use(express.json())
app.use(express.static('./public'))



//
// Request new SMART Health Link
//
app.post(config.CREATE_LINK, async (req, res) => {
    console.log('Received Request to create new SHL', config.CREATE_LINK, req.body);

    const request: SHLLinkRequest = req.body;

    if (!verifyRequest(request)) {
        res.status(400).send("Bad Request");
        return;
    }

    const entry = await encode(request);

    store.update(entry);

    res.type('text');
    res.send(entry.link);
});


//
// Request for manifest file
//
app.get('/shl/*', async (req, res) => {
    console.log('Received Request for Manifest File', '/shl/*', req.body);

    const url = req.url.split('/')[2];
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
app.post('/*', async (req, res) => {
    console.log('Received Request for Manifest', '/*', req.body);

    const params: ShlinkManifestRequest = req.body;
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
        `HTTP Server listening at ${url}`
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
            element.verifiableCredential.every((vc: any) => typeof vc === 'string')
        )
    ) return false;

    if (!payload) return true;

    const { path, key, exp, flag, label, v } = payload;

    if (path && typeof path !== 'string') return false;

    if (key && typeof key !== 'string') return false;

    if (exp && (typeof exp !== 'string' && typeof exp !== 'number')) return false;

    if (flag && !['L', 'LP', 'P'].includes(flag)) return false;

    if (label && typeof label !== 'string') return false;

    if (viewer && typeof viewer !== 'string') return false;

    if (v && typeof v !== 'number') return false;

    if (attempts && typeof attempts !== 'number') return false;

    return true;

}

function isObject(object: any): boolean {
    return Object.prototype.toString.call(object) === '[object Object]';
}

// process.on('exit', function (code) {
//     fs.writeFileSync('EXIT.txt', '');
//     console.log("exit");
//     //process.exit();
//     server.close(() => {
//         console.log('Closed server.');
//         process.exit(0);
//     });
// });


// process.on('SIGTERM', function (code) {
//     fs.writeFileSync('SIGTERM.txt', '');
//     console.log("SIGTERM");
//     //process.exit();
//     server.close(() => {
//         console.log('Closed server.');
//         process.exit(0);
//     });
// });

// process.on('SIGINT', function () {
//     fs.writeFileSync('SIGINT.txt', '');
//     console.log("SIGINT");
//     // process.exit();
//     server.close(() => {
//         console.log('Closed server.');
//         process.exit(0);
//     });
// })

// app.get('/exit', async (req, res) => {
//     console.log('Received Request \'/exit');
//     // setTimeout(() => {
//     //     process.exit(0);
//     // });
//     res.send();
//     server.close(() => {
//         console.log('Closed server.');
//         process.exit(0);
//     });
// });


// const readline = require('readline');

// const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// // Flag to be able to force the shutdown
// let isShuttingDown = false;

// // https://nodejs.org/api/readline.html
// rl.on('SIGINT', async () => {

//         fs.writeFileSync('SIGINT-ALT.txt', '');

//     console.log("SIGINT ================================= ")
//     //   if (isShuttingDown) {
//     //     logger.info("Forcing shutdown, bye.");
//     //     process.exit();
//     //   } else {
//     //     if (!<yourIsCleanupNecessaryCheck>()) {
//     //       logger.info("No cleanup necessary, bye.");
//     //       process.exit();
//     //     } else {
//     //       logger.info("Closing all opened pages in three seconds (press Ctrl+C again to quit immediately and keep the pages opened) ...");
//     //       isShuttingDown = true;
//     //       await sleep(3000);
//     //       await <yourCleanupLogic>();
//     //       logger.info("All pages closed, bye.");
//     //       process.exit();
//     //     }
// });