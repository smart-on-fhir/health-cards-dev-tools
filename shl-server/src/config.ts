// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export const config = {
    CREATE_LINK: '/create-link',
    PERSIST_LINKS: true,
    DEFAULT_ATTEMPTS: 8,
    SERVER_BASE : process.env.SERVER_BASE || 'http://localhost:' + (process.env.HOST_PORT || 8090) + '/',
    SERVICE_PORT: process.env.HOST_PORT || 8090
}