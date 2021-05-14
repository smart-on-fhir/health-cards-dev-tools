// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema, objPathToSchema } from './schema';
import fs from 'fs';
import { ErrorCode } from './error';
import fhirSchema from '../schema/fhir-schema.json';
import immunizationDM from '../schema/immunization-dm.json';
import patienDM from '../schema/patient-dm.json';
import Log from './logger';
import { ValidationResult } from './validate';
import beautify from 'json-beautify'

export enum ValidationProfiles {
    'any',
    'usa-covid19-immunization'
}

export class FhirOptions {
    static LogOutputPath = '';
    static ValidationProfile: ValidationProfiles = ValidationProfiles.any;
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

    if (FhirOptions.LogOutputPath) {
        fs.writeFileSync(FhirOptions.LogOutputPath, fhirBundleText); // should we instead print out the output of beautify
    }

    // failures will be recorded in the log
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


    for (let i = 0; i < fhirBundle.entry.length; i++) {

        const entry = fhirBundle.entry[i];
        const resource = entry.resource;

        validateSchema({ $ref: 'https://smarthealth.cards/schema/fhir-schema.json#/definitions/' + resource.resourceType }, resource, log, ['', 'entry', i.toString(), resource.resourceType].join('/'));

        if (resource == null) {
            log.error("Bundle.entry[" + i.toString() + "].resource missing");
            continue;
        }

        if (resource.id) {
            log.warn("Bundle.entry[" + i.toString() + "].resource[" + resource.resourceType + "] should not include .id elements", ErrorCode.FHIR_SCHEMA_ERROR);
        }

        if (resource.meta) {
            // resource.meta.security allowed as special case, however, no other properties may be included on .meta
            if (!resource.meta.security || Object.keys(resource.meta).length > 1) {
                log.warn("Bundle.entry[" + i.toString() + "].resource[" + resource.resourceType + "].meta should only include .security property with an array of identity assurance codes", ErrorCode.FHIR_SCHEMA_ERROR);
            }
        }

        if (resource.text) {
            log.warn("Bundle.entry[" + i.toString() + "].resource[" + resource.resourceType + "] should not include .text elements", ErrorCode.FHIR_SCHEMA_ERROR);
        }

        // walks the property tree of this resource object
        // the callback receives the child property and it's path 
        // objPathToSchema() maps a schema property to a property path
        // currently, oneOf types will break this system
        walkProperties(entry.resource as unknown as Record<string, unknown>, [entry.resource.resourceType], (o: Record<string, unknown>, path: string[]) => {

            const propType = objPathToSchema(path.join('.'));

            if (propType === 'CodeableConcept' && o['text']) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (CodeableConcept) should not include .text elements", ErrorCode.FHIR_SCHEMA_ERROR);
            }

            if (propType === 'Coding' && o['display']) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (Coding) should not include .display elements", ErrorCode.FHIR_SCHEMA_ERROR);
            }

            if (propType === 'Reference' && o['reference'] && !/[^:]+:\d+/.test(o['reference'] as string)) {
                log.warn('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " (Reference) should be short resource-scheme URIs (e.g., {“patient”: {“reference”: “resource:0”}})", ErrorCode.SCHEMA_ERROR);
            }

        });

        // with Bundle.entry.fullUrl populated with short resource-scheme URIs (e.g., {"fullUrl": "resource:0})
        if ((typeof entry.fullUrl !== 'string') || !/resource:\d+/.test(entry.fullUrl)) {
            log.warn('fhirBundle.entry.fullUrl should be short resource-scheme URIs (e.g., {“fullUrl”: “resource:0}"', ErrorCode.FHIR_SCHEMA_ERROR);
        }
    }

    if (FhirOptions.ValidationProfile === ValidationProfiles['usa-covid19-immunization']) {
        ValidationProfilesFunctions['usa-covid19-immunization'](fhirBundle.entry, log);
    }

    log.info("FHIR bundle validated");
    log.debug("FHIR Bundle Contents:");
    log.debug(beautify(fhirBundle, null as unknown as Array<string>, 3, 100));

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


const ValidationProfilesFunctions = {

    "any": function (entries: BundleEntry[]): boolean {
        return true || entries;
    },

    "usa-covid19-immunization": function (entries: BundleEntry[], log: Log): boolean {

        const patients = entries.filter(entry => entry.resource.resourceType === 'Patient');
        if (patients.length !== 1) {
            log.error("Profile:usa-covid19-immunization requires exactly 1 Patient resource. Actual : " + patients.length.toString(), ErrorCode.PROFILE_ERROR);
        }

        const immunizations = entries.filter(entry => entry.resource.resourceType === 'Immunization');
        if (immunizations.length === 0) {
            log.error("Profile:usa-covid19-immunization requires 1 or more Immunization resources. Actual : " + immunizations.length.toString(), ErrorCode.PROFILE_ERROR);
        }

        const expectedResources = ["Patient", "Immunization"];
        entries.forEach((entry, index) => {

            if (!expectedResources.includes(entry.resource.resourceType)) {
                log.error("Profile:usa-covid19-immunization ResourceType:" + entry.resource.resourceType + " is not allowed.", ErrorCode.PROFILE_ERROR);
                expectedResources.push(entry.resource.resourceType); // prevent duplicate errors
                return;
            }

            if (entry.resource.resourceType === "Immunization") {

                // verify that valid codes are used see : https://www.cdc.gov/vaccines/programs/iis/COVID-19-related-codes.html
                const code = (entry.resource?.vaccineCode as { coding: { code: string }[] })?.coding[0]?.code;
                const cvxCodes = ["207", "208", "210", "211", "212"];
                if (code && !cvxCodes.includes(code)) {
                    log.error("Profile:usa-covid19-immunization Immunization.vaccineCode.code requires valid COVID-19 code (" + cvxCodes.join(',') + ").", ErrorCode.PROFILE_ERROR);
                }

                // check for properties that are forbidden by the dm-profiles
                (immunizationDM as { path: string }[]).forEach(constraint => {
                    propPath(entry.resource, constraint.path) &&
                        log.error("Profile:usa-covid19-immunization entry[" + index.toString() + "].resource." + constraint.path + " should not be present.", ErrorCode.PROFILE_ERROR);
                });

            }

            if (entry.resource.resourceType === "Patient") {

                // check for properties that are forbidden by the dm-profiles
                (patienDM as { path: string }[]).forEach(constraint => {
                    propPath(entry.resource, constraint.path) &&
                        log.error("Profile:usa-covid19-immunization entry[" + index.toString() + "].resource." + constraint.path + " should not be present.", ErrorCode.PROFILE_ERROR);
                });

            }


        });

        return true;
    }
}

// get an object property using a string path
function propPath(object: Record<string, unknown>, path: string): string | undefined {
    const props = path.split('.');
    let val = object;
    for (let i = 1; i < props.length; i++) {
        val = val[props[i]] as Record<string, Record<string, unknown>>;
        if (val === undefined) return val;
    }
    return val as unknown as string;
}