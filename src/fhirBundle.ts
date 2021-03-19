// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema, objPathToSchema } from './schema';
import fs from 'fs';
import { ErrorCode } from './error';
import fhirSchema from '../schema/fhir-schema.json';
import Log from './logger';
import { ValidationResult } from './validate';
import beautify from 'json-beautify'

export class FhirLogOutput {
    static Path = '';
}

export function validate(fhirBundleText: string): ValidationResult {

    const log = new Log('FhirBundle');

    if (fhirBundleText.trim() !== fhirBundleText) {
        log.warn(`FHIR bundle has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        fhirBundleText = fhirBundleText.trim();
    }

    const fhirBundle = utils.parseJson<FhirBundle>(fhirBundleText);
    if (fhirBundle === undefined) {
        return {
            result: fhirBundle,
            log: log.fatal("Failed to parse FhirBundle data as JSON.", ErrorCode.JSON_PARSE_ERROR)
        }
    }

    if (FhirLogOutput.Path) {
        fs.writeFileSync(FhirLogOutput.Path, fhirBundleText); // should we instead print out the output of beautify above?
    }

    // failures will be recorded in the log.
    if (!validateSchema(fhirSchema, fhirBundle, log)) return new ValidationResult(undefined, log);


    // to continue validation, we must have a list of resources in .entry[]
    if (!fhirBundle.entry ||
        !(fhirBundle.entry instanceof Array) ||
        fhirBundle.entry.length === 0
    ) {
        // The schema check above will list the expected properties/type
        return {
            result: fhirBundle,
            log: log.fatal("FhirBundle.entry[] required to continue.", ErrorCode.CRITICAL_DATA_MISSING)
        }
    }


    if (fhirBundle.id) {
        log.warn("fhirBundle should not include Resource.id elements", ErrorCode.SCHEMA_ERROR);
    }

    if (fhirBundle.meta) {
        log.warn("fhirBundle should not include Resource.meta elements", ErrorCode.SCHEMA_ERROR);
    }

    if (fhirBundle.text) {
        log.warn("fhirBundle should not include Resource.text elements", ErrorCode.SCHEMA_ERROR);
    }
    
    for (let i = 0; i < fhirBundle.entry.length; i++) {

        const entry = fhirBundle.entry[i];

        if (entry.resource == null) {
            log.error("Bundle.entry[" + i.toString() + "].resource missing");
            continue;
        }

        // walks the property tree of this resource object
        // the callback receives the child property and it's path 
        // objPathToSchema() maps a schema property to a property path
        // currently, oneOf types will break this system
        walkProperties(entry.resource as unknown as Record<string, unknown>, [entry.resource.resourceType], (o: Record<string, unknown>, path: string[]) => {

            const propType = objPathToSchema(path.join('.'));

            if (propType === 'CodeableConcept' && o['text']) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (CodeableConcept) should not include .text elements", ErrorCode.SCHEMA_ERROR);
            }

            if (propType === 'Coding' && o['display']) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (Coding) should not include .display elements", ErrorCode.SCHEMA_ERROR);
            }

            if (propType === 'Reference' && o['reference'] && !/[^:]+:\d+/.test(o['reference'] as string)) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (Reference) should be short resource-scheme URIs (e.g., {“patient”: {“reference”: “Patient/r:0”}})", ErrorCode.SCHEMA_ERROR);
            }

        });

        // with Bundle.entry.fullUrl populated with short resource-scheme URIs (e.g., {"fullUrl": "resource:0})
        if ((typeof entry.fullUrl !== 'string') || !/resource:\d+/.test(entry.fullUrl)) {
            log.warn('fhirBundle.entry.fullUrl should be short resource-scheme URIs (e.g., {“fullUrl”: “resource:0}"', ErrorCode.SCHEMA_ERROR);
        }
    }

    log.info("Fhir Bundle Contents:");
    log.info(beautify(fhirBundle, null as unknown as Array<string>, 3, 100));

    return { result: fhirBundle, log: log };
}


// walks through an objects properties calling a callback with a path for each.
function walkProperties(obj: Record<string, unknown>, path: string[], callback: (o: Record<string, unknown>, p: string[]) => void): void {

    if (obj instanceof Array) {
        for (let i = 0; i < obj.length; i++) {
            const element = obj[i] as Record<string, unknown>;
            if (element instanceof Object) {
                walkProperties(element, path.slice(0), callback);
            }
        }
        return;
    }

    callback(obj, path);

    if (!(obj instanceof Object)) return;

    for (const propName in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, propName)) {
            const prop = obj[propName];
            path.push(propName);
            walkProperties(prop as Record<string, unknown>, path.slice(0), callback);
            path.pop();
        }
    }

    return;
}