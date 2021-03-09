import fhir_schema from '../schema/fhir-definitions-schema.json';
import fhir_bundle_schema from '../schema/fhir-bundle-schema.json';
import fs from 'fs';



// Takes the full fhir schema and prunes it down to just the required Bundle definitions

const bundle_refs = getUniqueBundleReferences(fhir_bundle_schema);

let fhir_refs = getFhirReferences(fhir_schema, bundle_refs);
fhir_refs = getFhirReferences(fhir_schema, fhir_refs);
fhir_refs = getFhirReferences(fhir_schema, fhir_refs);


const allRefs = bundle_refs.concat(fhir_refs);


const newSchema = pruneFhirSchema(fhir_schema, allRefs);

fs.writeFileSync('trimmed.fhir.schema.json', JSON.stringify(newSchema, null, 4));


function pruneFhirSchema(fhirSchema: Record<string, unknown>, bundle_refs: string[]) {

    const defs = fhir_schema.definitions;

    for (const key in defs) {
        if (Object.prototype.hasOwnProperty.call(defs, key)) {
            if (bundle_refs.indexOf(key) < 0) {
                delete (fhir_schema.definitions as { [key: string]: unknown })[key];
            }
        }
    }

    return fhirSchema;
}



function findChildRefs(definition: Record<string, unknown | string>): string[] {

    let result: string[] = [];

    for (const key in definition) {
        if (Object.prototype.hasOwnProperty.call(definition, key)) {
            const prop = definition[key];
            if (key === '$ref') result.push(prop as string);
            if (key === 'oneOf') continue;
            if (prop instanceof Object) {
                result = result.concat(findChildRefs(definition[key] as Record<string, unknown>));
            }
        }
    }
    return result;
}

// from a list of bundle refs, collect all the internal references to fhir-schema definitions
// a definition, refered to by a bundle ref, may reference other internal references
function getFhirReferences(fhirSchema: Record<string, unknown>, bundle_refs: string[]): string[] {

    const defs = fhir_schema.definitions;
    let child_refs: string[] = bundle_refs.slice();

    for (const key of bundle_refs) {
        if (Object.prototype.hasOwnProperty.call(defs, key)) {
            const prop = (defs as Record<string, unknown>)[key];
            child_refs = child_refs.concat(
                findChildRefs(prop as Record<string, unknown>))
                .map(ref => ref.slice(ref.lastIndexOf('/') + 1));
        }
    }

    // remove the duplicates and trim to just the definition name
    return child_refs
        .filter((ref, index) => child_refs.indexOf(ref) === index);
}


// returns unique external references to fhir-schema definitions
function getUniqueBundleReferences(bundleSchema: unknown): string[] {

    const refs = JSON.stringify(bundleSchema)
        .match(/"\$ref":"fhir\.schema\.json#\/definitions\/(.+?)"/g) || [];

    // remove the duplicates and trim to just the definition name
    return refs
        .filter((ref, index) => refs.indexOf(ref) === index)
        .map(ref => ref.slice(ref.lastIndexOf('/') + 1, ref.length - 1));
}

