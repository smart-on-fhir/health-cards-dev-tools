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

// The CDC CVX covid vaccine codes (https://www.cdc.gov/vaccines/programs/iis/COVID-19-related-codes.html),
export const cdcCovidCvxCodes = ["207", "208", "210", "212", "217", "218", "219", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "510", "511"];

// Currently pre-authorized CDC CVX covid vaccine codes
export const cdcCovidAuthorizedCvxCodes = ["207", "208", "212", "217", "218"];

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

// eslint-disable-next-line @typescript-eslint/require-await
export async function validate(fhirBundleText: string): Promise<Log> {

    const log = new Log('FhirBundle');
    const profile: ValidationProfiles = FhirOptions.ValidationProfile;

    if (fhirBundleText.trim() !== fhirBundleText) {
        log.error(`FHIR bundle has leading or trailing spaces`, ErrorCode.TRAILING_CHARACTERS);
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


    // loop through all the entries to collect the .fullUrl for each entry and make sure there aren't duplicates
    // we need to know all the Entry fullUrls up-front so we can verify all the child references later.
    const entryFullUrls: Array<string> = [];
    for (let i = 0; i < fhirBundle.entry.length; i++) {
        const entry = fhirBundle.entry[i];
        // with Bundle.entry.fullUrl populated with short resource-scheme URIs (e.g., {"fullUrl": "resource:0})
        if ((typeof entry.fullUrl !== 'string') || !/^resource:\d+/.test(entry.fullUrl)) {
            log.error(`fhirBundle.entry[${i.toString()}].fullUrl = "${entry.fullUrl as string}" should be short resource-scheme URIs (e.g., {"fullUrl": "resource:0})"`, ErrorCode.FHIR_SCHEMA_ERROR);
            entryFullUrls.push(entry.fullUrl as string);

        } else {
            const duplicate = entryFullUrls.indexOf(entry.fullUrl);
            if (duplicate >= 0) {
                log.error(`fhirBundle.entry[${i.toString()}].fullUrl = "${entry.fullUrl}" duplicate of fhirBundle.entry[${duplicate}].fullUrl`, ErrorCode.FHIR_SCHEMA_ERROR);
            } else {
                entryFullUrls.push(entry.fullUrl);
            }
        }
    }

    //
    // Validate each resource of .entry[]
    //
    for (let e = 0; e < fhirBundle.entry.length; e++) {

        const entry = fhirBundle.entry[e];
        const resource = entry.resource;

        const resourcePathRoot = `/entry/${e.toString()}`;

        if (resource == null) {
            log.error(`Schema: ${resourcePathRoot}.resource missing`);
            continue;
        }

        if (!resource.resourceType) {
            log.error(`Schema: ${resourcePathRoot}.resource.resourceType missing`);
            continue;
        }

        const entryPath = `${resourcePathRoot}/${resource.resourceType}`;

        if (!(fhirSchema.definitions as Record<string, unknown>)[resource.resourceType]) {
            log.error(`Schema: ${entryPath} unknown Entry type`);
            continue;
        }

        if (resource.resourceType === 'Immunization') {

            if (!resource.status) {
                log.error(`Schema: ${entryPath} requires property status`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

            if (resource.status && resource.status != 'completed') {
                log.error(`Schema: ${entryPath}/status:'${resource.status as string}' should be 'completed'`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

            // verify that a valid occurrenceDateTime is present
            if (!resource.occurrenceDateTime && !resource.occurrenceString) {
                log.error(`Schema: ${entryPath} requires property (occurrenceDateTime|occurrenceString)`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

            if (resource.occurrenceDateTime && resource.occurrenceString) {
                log.error(`Schema: ${entryPath} should not possess both 'occurrenceDateTime' & 'occurrenceString'`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

        }

        // Because entries in a Bundle may be of many possible types (Immunization, Patient, etc...), the json-schema defines this using a 'oneOf' type collection.
        // When we fail to match an object to one of the 'oneOf' types, you get multiple errors for each failed match.
        // This can be a 100+ schema errors when you just misspelled a property name - it makes it impossible to determine the cause of
        // the error if you don't have intimate knowledge of both the schema and the intended input.
        // So instead of validating the entry against the 'oneOf' schema type, we extract the 'resourceType' name and validate against that
        // definition in the fhir schema definitions file. So we'll only get the errors related to this specific type.
        // Using a 'discriminator' is supposed to solve this problem by mapping an object to a specific 'oneOf' type, but I found the ajv support unsatisfactory.
        validateSchema({ $ref: 'https://smarthealth.cards/schema/fhir-schema.json#/definitions/' + resource.resourceType }, resource, log, ['', 'entry', e.toString(), resource.resourceType].join('/'));

        if (resource.id) {
            log.warn(`${entryPath}/ should not include .id elements"`, ErrorCode.FHIR_SCHEMA_ERROR);
        }

        if (resource.meta) {
            // resource.meta.security allowed as special case, however, no other properties may be included on .meta
            if (!resource.meta.security || Object.keys(resource.meta).length > 1) {
                log.warn(`${entryPath}/.meta should only include .security property with an array of identity assurance codes`, ErrorCode.FHIR_SCHEMA_ERROR);
            }
        }

        if (resource.text) {
            log.warn(`${entryPath}/ should not include .text elements`, ErrorCode.FHIR_SCHEMA_ERROR);
        }


        // ↓ Type-based validation ↓

        // Some validation is done based on a property's schema type and not the property's name.
        // for this, we need to determine its type as defined by the schema.
        // We walk an objects property tree while mapping each property to a schema type.
        // the callback receives the child property and it's path 
        // objPathToSchema() maps a schema property to a property path
        // currently, oneOf property types will break this system
        walkProperties(entry.resource as unknown as Record<string, unknown>, [entry.resource.resourceType], (o: Record<string, unknown>, path: string[]) => {

            // gets the schema type for this property base on the property's path
            const propType = objPathToSchema(path.join('.'));
            const outputPath = `entry/${e.toString()}/${path.join('.').replace(/\./g, '/')}`;

            if (propType === 'CodeableConcept' && o['text']) {
                log.warn(`${outputPath} (CodeableConcept) should not include .text elements`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

            if (propType === 'Coding' && o['display']) {
                log.warn(`${outputPath} (Coding) should not include .display elements`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

            // reference must be the following form: reference:#
            if (propType === 'Reference' && o['reference'] && !/^resource:\d+/.test(o['reference'] as string)) {
                log.error(`${outputPath} = "${o['reference'] as string}" (Reference) should be short resource-scheme URIs (e.g., {"${path[path.length - 1]}": {"reference": "resource:0"}})`, ErrorCode.SCHEMA_ERROR);
            }

            // the reference must map to one of the Entry.fullUrls collected above
            if (propType === 'Reference' && o['reference'] && !entryFullUrls.includes(o['reference'] as string)) {
                log.error(`${outputPath} = "${o['reference'] as string}" (Reference) is not defined by an entry.fullUrl [${(entryFullUrls.length > 3 ? entryFullUrls.slice(0, 3).concat(['...']) : entryFullUrls).join(',')}]`, ErrorCode.SCHEMA_ERROR);
            }

            if (  // warn on empty string, empty object, empty array
                (o instanceof Array && o.length === 0) ||
                (typeof o === 'string' && o === '') ||
                (o instanceof Object && Object.keys(o).length === 0)
            ) {
                log.error(`${outputPath} is empty. Empty elements are invalid.`, ErrorCode.FHIR_SCHEMA_ERROR);
            }

        });

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
        const profileLabel = `Profile[${profileName}]`;

        const patients = entries.filter(entry => entry.resource.resourceType === 'Patient');
        if (patients.length !== 1) {
            log.error(`${profileLabel} requires exactly 1 ${'Patient'} resource. Actual : ${patients.length.toString()}`, ErrorCode.PROFILE_ERROR);
        }

        const immunizations = entries.filter(entry => entry.resource.resourceType === 'Immunization');
        if (immunizations.length === 0) {
            log.error(`${profileLabel} requires 1 or more Immunization resources. Actual : ${immunizations.length.toString()}`, ErrorCode.PROFILE_ERROR);
        }

        const expectedResources = ["Patient", "Immunization"];
        entries.forEach((entry, index) => {

            const resource = entry.resource;

            if (!expectedResources.includes(entry.resource.resourceType)) {
                log.error(`${profileLabel} entry/${index.toString()}/${entry.resource.resourceType} is not allowed.`, ErrorCode.PROFILE_ERROR);
                expectedResources.push(entry.resource.resourceType); // prevent duplicate errors
                return;
            }

            if (entry.resource.resourceType === "Immunization") {

                // verify that valid covid vaccine codes are used
                const code = (resource?.vaccineCode as { coding: { code: string }[] })?.coding[0]?.code;
                if (code && !cdcCovidAuthorizedCvxCodes.includes(code)) {
                    log.error(`${profileLabel} Immunization/vaccineCode/code requires valid CDC-authorized COVID-19 CVX code (${cdcCovidCvxCodes.join(',')}).`, ErrorCode.PROFILE_ERROR);
                }

                // check for properties that are forbidden by the dm-profiles
                (immunizationDM as { mustNotContain: { path: string }[] }).mustNotContain.forEach(constraint => {
                    propPath(resource, constraint.path) &&
                        log.error(`${profileLabel} /entry/${index.toString()}/${constraint.path.replace('.', '/')} should not be present`, ErrorCode.PROFILE_ERROR);
                });

                // verify that a valid occurrenceDateTime is present and the expected dm format
                if (!resource.occurrenceDateTime) {
                    log.error(`${profileLabel} /entry/${index.toString()}/${resource.resourceType} requires property occurrenceDateTime`, ErrorCode.PROFILE_ERROR);
                }

                // occurrenceDateTime requires a more compact representation when using this profile
                if (resource.occurrenceDateTime && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(resource.occurrenceDateTime as string)) {
                    log.error(`${profileLabel} /entry/${index.toString()}/${resource.resourceType}/occurrenceDateTime '${resource.occurrenceDateTime as string}' should be 'YYYY-MM-DD'`, ErrorCode.PROFILE_ERROR);
                }

                // check the specific property patterns are valid
                (immunizationDM as { pattern: { path: string, pattern: string }[] }).pattern.forEach(constraint => {
                    const regex = new RegExp(constraint.pattern);
                    const value = propPath(resource, constraint.path) || '';
                    regex.test(value) ||
                        log.error(`${profileLabel} /entry/${index.toString()}/${constraint.path.replace('.', '/')}:'${value}' does not match pattern '${constraint.pattern}'`, ErrorCode.PROFILE_ERROR);
                });
            }

            if (resource.resourceType === "Patient") {
                // check for properties that are forbidden by the dm-profiles
                (patientDM as { mustNotContain: { path: string }[] }).mustNotContain.forEach(constraint => {
                    propPath(entry.resource, constraint.path) &&
                        log.error(`${profileLabel} /entry/${index.toString()}/${constraint.path.replace(/\./g, '/')} should not be present`, ErrorCode.PROFILE_ERROR);
                });
            }

        });

        return true;
    }
}

