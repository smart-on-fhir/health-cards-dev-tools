import fs from 'fs';
import got from 'got';


interface Profile {
    "snapshot": {
        "element": {
            "min": number,
            "max": string,
            "path": string
        }[]
    }
}

const patient_profile_dm_url = 'http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/StructureDefinition-vaccination-credential-patient-dm.json';
const immunization_profile_dm_url = 'http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/StructureDefinition-vaccination-credential-immunization-dm.json';



async function fetchProfile(url: string, fileName: string): Promise<void> {

    let profileJson: Profile;

    try {
        profileJson = await got(url).json();
    } catch {
        // if we didn't get a profile, just return and the existing one will get used
        console.warn("could not download profile from : " + url);
        console.warn("existing profile will be used : " + fileName);
        return;
    }

    // keep just the paths of the 0..0 properties
    fs.writeFileSync(fileName, JSON.stringify(
        profileJson.snapshot.element
            .filter(e => e.min === 0 && parseInt(e.max) === 0)
            .map(e => { return { "path": e.path } })
        , null, 4));

    return;
}


void (async () => {
    await fetchProfile(patient_profile_dm_url, './schema/patient-dm.json');
    await fetchProfile(immunization_profile_dm_url, './schema/immunization-dm.json');
})();