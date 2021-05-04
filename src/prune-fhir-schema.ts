// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

//import fhir_schema from '../schema/fhir-schema-full.json';
import fs from 'fs';
import JSZip from 'jszip'
import got from 'got'


const fullSchemaLink = 'https://hl7.org/fhir/fhir.schema.json.zip'


//
// Unzip the full FHIR schema
//
async function getFullSchema(): Promise<Schema> {

    const zip = new JSZip();
    const zipPath = "./schema/fhir.schema.json.zip";
    const outPath = './schema/fhir-schema-full.json';
    const zipFileName = "fhir.schema.json";

    const zipBuffer = await got(fullSchemaLink).buffer();

    // process the buffer with zip
    const zipArchive = await zip.loadAsync(zipBuffer);

    // extract a selected file - there would be only one file for our use
    const zipFileData = zipArchive.file(zipFileName);
    if (!zipFileData) throw new Error(zipFileName + " not found in zip file : " + zipPath);

    // get the un-zipped data
    const fileContent = await zipFileData.async('string');
    fs.writeFileSync(outPath, fileContent);

    return JSON.parse(fileContent) as Schema;
}



//
// Creates a smaller FHIR sub-schema from a list of FHIR Resources
// The new schema will contain the Resources and any child definitions required by those Resources.
//
async function pruneSchema(resources: string[]/*, fullFhirSchema?: Schema*/): Promise<Schema> {

    const fullFhirSchema: Schema = await getFullSchema();

    const newSchema: Schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://smarthealth.cards/schema/fhir-schema.json",
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

    // Schema validation of the Bundle.entries will happen separately.  We'll replace the ResourceList type
    // with a generic object to prevent further validation here.
    // The reason is that if the entry items have bad schema, we will get dozens of errors as the bad-schema object
    // fails to match any of the possible Resources. So instead, we validate the entries individually against
    // the resource type specified in its resourceType field.
    newSchema.definitions['Bundle_Entry'].properties!.resource = { "type": "object" };

    return newSchema;
}

function findChildRefs(schema: Schema, definitionName: string, definitionList: string[], indent = ""): void {

    // Special case, do nothing as we are in the process of building this list
    if (definitionName === 'ResourceList') return;

    // do nothing is this is a known def
    if (definitionList.includes(definitionName)) return;

    console.log(indent + definitionName);

    // add the definition
    const definition = schema.definitions[definitionName];
    delete definition.description;

    definitionList.push(definitionName);

    // recurse the defs properties
    for (const key in definition.properties) {

        // Extension properties begin with '_' - remove them unless extensions are required
        if (key.substring(0, 1) === '_') {
            delete definition.properties[key];
            continue;
        }

        const prop = definition.properties[key];
        // remove description field to save some space
        delete prop.description;


        if (prop["$ref"]) {
            const ref = prop["$ref"].slice(prop["$ref"].lastIndexOf('/') + 1);
            definitionList.includes(ref) || findChildRefs(schema, ref, definitionList, indent + "    ");
            continue;
        }
        if (prop.items && '$ref' in prop.items) {
            const ref = prop.items.$ref.slice(prop.items["$ref"].lastIndexOf('/') + 1);

            // remove Extension properties to further reduce the schema size
            // comment this out is Extensions are required
            if (ref === 'Extension') {
                delete definition.properties[key];
                continue;
            }

            definitionList.includes(ref) || findChildRefs(schema, ref, definitionList, indent + "    ");
            continue;
        }
    }

    return;
}

void pruneSchema([
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
]).then(schema => {
    fs.writeFileSync('./schema/fhir-schema.json', JSON.stringify(schema, null, 2));
})

