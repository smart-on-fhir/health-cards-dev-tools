import execa from 'execa';
import fs from 'fs';
import path from 'path';
import Log, {note} from '../src/logger';
import { ErrorCode } from './error';

let log : Log;

const imageName = 'java.docker.image';
const dockerFile = 'java.Dockerfile';


export function isDockerAvailable(): boolean {
    const result = runCommand('docker --version');
    return result.exitCode === 0;
}

function dockerImageExists(imageName: string): boolean {
    const result = runCommand(`docker image inspect ${imageName}`);
    return result.exitCode === 0;
}

function runCommand(command: string) {
    try {

        return execa.commandSync(command);

    } catch (error) {

        // if exitCode !== 0 this error will be thrown
        // this error object is similar to the result object that would be returned if successful. 
        // we'll return it an sort out the errors there.
        return error as execa.ExecaSyncError;
    }
}

function buildDockerImage(dockerFile: string, imageName: string): boolean {

    if(!fs.existsSync(dockerFile)) {
        log.error(`Cannot find Dockerfile ${dockerFile}`);
        return false;
    }

    log.debug(`Building Docker image ${imageName} from ${dockerFile}`);

    const result = runCommand(`docker build -t ${imageName} -f ${dockerFile} .`);

    // docker returns build steps on stderr
    log.debug(result.stdout || result.stderr);

    return result.exitCode === 0;
}


export function validate(fileOrJSON: string, logger = new Log('FHIR Validator')): Log {

    log = logger;

    note(`The FHIR-Validator may take additional time to run its validations.\n`);

    const tempFileName = 'temp.fhirbundle.json';

    if(JSON.parse(fileOrJSON)) {
        fs.writeFileSync(tempFileName, fileOrJSON);  // overwrites by default
        fileOrJSON = tempFileName;
    }

    if (!isDockerAvailable()) {
        log.error('Docker not found.');
        return log;
    }

    if (!dockerImageExists(imageName)) {
        log.debug(`Image ${imageName} not found. Attempting to build.`);
        if (!buildDockerImage(dockerFile, imageName)) return log.error('Could not build Docker image.');
    }

    const artifact = path.resolve(fileOrJSON);

    if (!fs.existsSync(artifact)) {
        return log.error(`Artifact ${artifact} not found.`);
    }

    const fileName = path.basename(artifact);

    const dockerCommand = `java -jar validator_cli.jar ${fileName}`;

    const command = `docker run --mount type=bind,source=${artifact},target=/${fileName} ${imageName} ${dockerCommand}`;

    const result = runCommand(command);

    log.debug(result.stdout);

    if(/Information: All OK/.test(result.stdout)) {
        return log;
    }

    const errors = result.stdout.match(/(?<=\n\s*Error @ ).+/g) || [];
    errors.forEach(err => {
        const formattedError = splitLines(err);
        log.error(formattedError, ErrorCode.FHIR_VALIDATOR_ERROR);
    });

    const warnings = result.stdout.match(/(?<=\n\s*Warning @ ).+/g) || [];
    warnings.forEach(warn => {
        const formattedError = splitLines(warn);
        log.warn(formattedError, ErrorCode.FHIR_VALIDATOR_ERROR);
    });

    if(!errors && !warnings) {
        log.error(`${fileName} : failed to find Errors or 'All OK'`);
    }

    return log;
}

// removes the Docker image necessitating a re-build for a future call
function cleanupImage(imageName: string): void {
    log && log.debug(`Remove Docker image ${imageName}`);
    runCommand(`docker image rm -f ${imageName}`);
}

// splits long lines 
function splitLines(text : string, width = Math.floor(process.stdout.columns * 0.9)) {
    const regex = new RegExp(`.{1,${width}}[^ ]* ?`, 'g');
    const result = text.match(regex);
    if(result == null) return text;
    return result.join('\n');
}

//cleanupImage(imageName);