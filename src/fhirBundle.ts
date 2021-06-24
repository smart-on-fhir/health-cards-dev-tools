// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as utils from './utils';
import { validateSchema, objPathToSchema } from './schema';
import fs from 'fs';
import { ErrorCode } from './error';
import fhirSchema from '../schema/fhir-schema.json';
import immunizationDM from '../schema/immunization-dm.json';
import patientDM from '../schema/patient-dm.json';
import Log from './logger';
import beautify from 'json-beautify'
import { propPath, walkProperties } from './utils';

// CDC covid vaccine codes (https://www.cdc.gov/vaccines/programs/iis/COVID-19-related-codes.html)
export const cdcCovidCvxCodes = ["207", "208", "210", "211", "212"];

// LOINC covid test codes (https://vsac.nlm.nih.gov/valueset/2.16.840.1.113762.1.4.1114.9/expansion)
export const loincCovidTestCodes = ["50548-7", "68993-5", "82159-5", "94306-8", "94307-6", "94308-4", "94309-2", "94500-6", "94502-2", "94503-0", "94504-8", "94507-1", "94508-9", "94531-1", "94533-7", "94534-5", "94547-7", "94558-4", "94559-2", "94562-6", "94563-4", "94564-2", "94565-9", "94640-0", "94661-6", "94756-4", "94757-2", "94758-0", "94759-8", "94760-6", "94761-4", "94762-2", "94764-8", "94845-5", "95209-3", "95406-5", "95409-9", "95416-4", "95423-0", "95424-8", "95425-5", "95542-7", "95608-6", "95609-4"];

export enum ValidationProfiles {
    'any',
    'usa-covid19-immunization'
}

export class FhirOptions {
    static LogOutputPath = '';
    static ValidationProfile: ValidationProfiles = ValidationProfiles.any;
}

export function validate(fhirBundleText: string): Log {

    const log = new Log('FhirBundle');
    const profile : ValidationProfiles = FhirOptions.ValidationProfile;

    if (fhirBundleText.trim() !== fhirBundleText) {
        log.warn(`FHIR bundle has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
        fhirBundleText = fhirBundleText.trim();
    }

    const fhirBundle = utils.parseJson<FhirBundle>(fhirBundleText);
    if (fhirBundle === undefined) {
        return log.fatal("Failed to parse FhirBundle data as JSON.", ErrorCode.JSON_PARSE_ERROR);
    }

    if (FhirOptions.LogOutputPath) {
        fs.writeFileSync(FhirOptions.LogOutputPath, fhirBundleText); // should we instead print out the output of beautify
    }

    // failures will be recorded in the log
    if (!validateSchema(fhirSchema, fhirBundle, log)) return log;


    // to continue validation, we must have a list of resources in .entry[]
    if (!fhirBundle.entry ||
        !(fhirBundle.entry instanceof Array) ||
        fhirBundle.entry.length === 0
    ) {
        // The schema check above will list the expected properties/type
        return log.fatal("FhirBundle.entry[] required to continue.", ErrorCode.CRITICAL_DATA_MISSING);
    }

    //
    // Validate each resource of .entry[]
    //
    for (let i = 0; i < fhirBundle.entry.length; i++) {

        const entry = fhirBundle.entry[i];
        const resource = entry.resource;

        if (resource == null) {
            log.error(`Schema: entry[${i.toString()}].resource missing`);
            continue;
        }

        if(!resource.resourceType) {
            log.error(`Schema: entry[${i.toString()}].resource.resourceType missing`);
            continue;
        }

        if(!(fhirSchema.definitions as Record<string, unknown>)[resource.resourceType]) {
            log.error(`Schema: entry[${i.toString()}].resource.resourceType '${resource.resourceType}' unknown`);
            continue;
        }

        validateSchema({ $ref: 'https://smarthealth.cards/schema/fhir-schema.json#/definitions/' + resource.resourceType }, resource, log, ['', 'entry', i.toString(), resource.resourceType].join('/'));

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

            if (  // warn on empty string, empty object, empty array
                (o instanceof Array && o.length === 0) ||
                (typeof o === 'string' && o === '') ||
                (o instanceof Object && Object.keys(o).length === 0)
            ) {
                log.error('fhirBundle.entry[' + i.toString() + ']' + ".resource." + path.join('.') + " is empty. Empty elements are invalid.", ErrorCode.FHIR_SCHEMA_ERROR);
            }

        });

        // with Bundle.entry.fullUrl populated with short resource-scheme URIs (e.g., {"fullUrl": "resource:0})
        if ((typeof entry.fullUrl !== 'string') || !/resource:\d+/.test(entry.fullUrl)) {
            log.warn('fhirBundle.entry.fullUrl should be short resource-scheme URIs (e.g., {“fullUrl”: “resource:0}"', ErrorCode.FHIR_SCHEMA_ERROR);
        }
    }

    if (profile === ValidationProfiles['usa-covid19-immunization']) {
        log.info(`applying profile : usa-covid19-immunization`);
        ValidationProfilesFunctions['usa-covid19-immunization'](fhirBundle.entry, log);
    }

    log.info("FHIR bundle validated");
    log.debug("FHIR Bundle Contents:");
    log.debug(beautify(fhirBundle, null as unknown as Array<string>, 3, 100));

    return log;
}

const ValidationProfilesFunctions = {

    "any": function (entries: BundleEntry[]): boolean {
        return true || entries;
    },

    "usa-covid19-immunization": function (entries: BundleEntry[], log: Log): boolean {

        const profileName = 'usa-covid19-immunization';

        const patients = entries.filter(entry => entry.resource.resourceType === 'Patient');
        if (patients.length !== 1) {
            log.error(`Profile : ${profileName} : requires exactly 1 ${'Patient'} resource. Actual : ${patients.length.toString()}`, ErrorCode.PROFILE_ERROR);
        }

        const immunizations = entries.filter(entry => entry.resource.resourceType === 'Immunization');
        if (immunizations.length === 0) {
            log.error(`Profile : ${profileName} : requires 1 or more Immunization resources. Actual : ${immunizations.length.toString()}`, ErrorCode.PROFILE_ERROR);
        }

        const expectedResources = ["Patient", "Immunization"];
        entries.forEach((entry, index) => {

            if (!expectedResources.includes(entry.resource.resourceType)) {
                log.error(`Profile : ${profileName} : resourceType: ${entry.resource.resourceType} is not allowed.`, ErrorCode.PROFILE_ERROR);
                expectedResources.push(entry.resource.resourceType); // prevent duplicate errors
                return;
            }

            if (entry.resource.resourceType === "Immunization") {

                // verify that valid covid vaccine codes are used
                const code = (entry.resource?.vaccineCode as { coding: { code: string }[] })?.coding[0]?.code;
                if (code && !cdcCovidCvxCodes.includes(code)) {
                    log.error(`Profile : ${profileName} : Immunization.vaccineCode.code requires valid COVID-19 code (${cdcCovidCvxCodes.join(',')}).`, ErrorCode.PROFILE_ERROR);
                }

                // check for properties that are forbidden by the dm-profiles
                (immunizationDM as { path: string }[]).forEach(constraint => {
                    propPath(entry.resource, constraint.path) &&
                        log.error(`Profile : ${profileName} : entry[${index.toString()}].resource.${constraint.path} should not be present.`, ErrorCode.PROFILE_ERROR);
                });

            }

            if (entry.resource.resourceType === "Patient") {

                // check for properties that are forbidden by the dm-profiles
                (patientDM as { path: string }[]).forEach(constraint => {
                    propPath(entry.resource, constraint.path) &&
                        log.error(`Profile : ${profileName} : entry[${index.toString()}].resource.${constraint.path} should not be present.`, ErrorCode.PROFILE_ERROR);
                });

            }

        });

        return true;
    }
}

