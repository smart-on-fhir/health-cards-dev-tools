// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import fhir_schema from '../schema/fhir-schema-full.json';
import fs from 'fs';


//
// Creates a smaller FHIR sub-schema from a list of FHIR Resources
// The new schema will contain the Resources and any child definitions required by those Resources.
//
function pruneSchema(resources: string[], fullFhirSchema: Schema): Schema {

    const newSchema: Schema = {
        $schema: fullFhirSchema.$schema,
        $id: fullFhirSchema.$id,
        oneOf: [{
            $ref: "#/definitions/Bundle"
        }],
        definitions: {
            ResourceList: {
                oneOf: []
            }
        }
    };

    const definitionNames: string[] = [];
    const oneOf = newSchema.definitions.ResourceList.oneOf || [];

    // for each required resource, find all the child definitions
    // definitionNames will fill with all the required child-definitions
    resources.forEach(resource => findChildRefs(fullFhirSchema, resource, definitionNames));

    definitionNames.sort();

    definitionNames.forEach(name => {

        const def = fullFhirSchema.definitions[name];
        newSchema.definitions[name] = def;

        // If this def is a Resource type, add a $ref to the oneOf collection
        if (def.properties && def.properties.resourceType && def.properties.resourceType.const) {
            oneOf.push({ "$ref": "#/definitions/" + def.properties.resourceType.const });
        }
    })

    return newSchema;
}

function findChildRefs(schema: Schema, definitionName: string, definitionList: string[]): void {

    // Special case, do nothing as we are in the process of building this list
    if(definitionName === 'ResourceList') return;

    // do nothing is this is a known def
    if (definitionList.includes(definitionName)) return;

    // add the definition
    const definition = schema.definitions[definitionName];
    definitionList.push(definitionName);

    // recurse the defs properties
    for (const key in definition.properties) {
        const prop = definition.properties[key];
        if (prop["$ref"]) {
            const ref = prop["$ref"].slice(prop["$ref"].lastIndexOf('/') + 1);
            findChildRefs(schema, ref, definitionList);
            continue;
        }
        if (prop.items && '$ref' in prop.items) {
            const ref = prop.items.$ref.slice(prop.items["$ref"].lastIndexOf('/') + 1);
            findChildRefs(schema, ref, definitionList);
            continue;
        }
    }

    return;
}

const prunedFhirSchema = pruneSchema([
    "Bundle",
    "Patient",
    "DiagnosticReport",
    "Observation",
    "Immunization",
    "Location",
    "Organization",
    "Condition",
    "Encounter",
    "AllergyIntolerance",
    "MedicationRequest",
    "Medication",
    "Specimen"
], fhir_schema as Schema);

fs.writeFileSync('./schema/fhir-schema.json', JSON.stringify(prunedFhirSchema, null, 2));
