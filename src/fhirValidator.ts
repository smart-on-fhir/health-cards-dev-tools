import fs from 'fs';
import path from 'path';
import Log from '../src/logger';
import { ErrorCode } from './error';
import color from 'colors';
import got from 'got';
import { runCommand, runCommandSync } from '../src/command';
import crypto from 'crypto';

const imageName = 'fhir.validator.image';
const dockerFile = 'fhir.validator.Dockerfile';
const dockerContainer = 'fhir.validator.container';
const validatorJarFile = 'validator_cli.jar';
const validatorUrl = 'https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar';
const tempFilePrefix = 'tempfhirbundle';


// share a log between the functions. This can be passed in externally through the validate() function
let log: Log;


async function downloadFHIRValidator(): Promise<void> {
    try {
        fs.writeFileSync(validatorJarFile, (await got(validatorUrl, { followRedirect: true }).buffer()));
    } catch (err) {
        log.debug(`File download error ${(err as Error).toString()}`);
    }
}


// Runs the FHIR validator using the installed JRE
async function runValidatorJRE(artifactPath: string): Promise<CommandResult | null> {

    if (!fs.existsSync(validatorJarFile)) await downloadFHIRValidator();

    if (!fs.existsSync(validatorJarFile)) {
        log.error(`Failed to download FHIR Validator Jar file ${validatorJarFile} from ${validatorUrl}`);
        return null;
    }

    const tempJarFile = `./validator_cli_${crypto.randomBytes(4).readUInt32LE(0)}.jar`;

    fs.copyFileSync(`./${validatorJarFile}`, tempJarFile);

    const result: CommandResult = await runCommand(`java -jar ./${tempJarFile} ./${artifactPath}`, `Running HL7 FHIR validator with JRE`, log);

    fs.rmSync(tempJarFile);

    return result;
}


// Runs the FHIR validator in a Docker container
async function runValidatorDocker(artifactPath: string): Promise<CommandResult | null> {

    if (!await Docker.checkPermissions()) return null;

    if (!await Docker.imageExists(imageName)) {
        log.debug(`Image ${imageName} not found. Attempting to build.`);
        if (!await Docker.buildImage(dockerFile, imageName)) {
            log.error('Could not build Docker image.');
            return null;
        }
    }

    const dockerCommand = `java -jar validator_cli.jar data/${artifactPath}`;

    // create a new container from image, copies the 
    const command = `docker run --rm --name ${dockerContainer} -v ${path.resolve(path.dirname(artifactPath))}:/data  ${imageName} ${dockerCommand}`;

    const result = await runCommand(command, `Running HL7 FHIR validator with Docker (${imageName})`, log);

    return result;
}


export async function validate(fileOrJSON: string, logger = new Log('FHIR Validator')): Promise<Log> {

    log = logger;

    const usingJre = JRE.isAvailable();
    const usingDocker = !usingJre && Docker.isAvailable();
    const tempFileName = `${tempFilePrefix}${crypto.randomBytes(4).readUInt32LE(0)}.json`;

    if (!usingJre && !usingDocker) {
        return log.error(
            `Validator: use of option ${color.italic('--validator fhirvalidator')} requires Docker or JRE to execute the FHIR Validator Java application.  See: http://hl7.org/fhir/validator/`,
            ErrorCode.JRE_OR_DOCKER_NOT_AVAILABLE
        );
    }

    if (JSON.parse(fileOrJSON)) {
        log.debug(`writing valid json as temp file ${tempFileName}`);
        fs.writeFileSync(tempFileName, fileOrJSON);  // overwrites by default
        fileOrJSON = tempFileName;
    } else {
        log.debug(`not valid JSON ${fileOrJSON}, no temp file created.`);
    }

    await runCommand(`ls -la`, `ls`, log);

    const artifact = path.resolve(fileOrJSON);

    if (!fs.existsSync(artifact)) {
        return log.error(`Artifact ${artifact} not found.`);
    }

    const fileName = path.basename(artifact);

    const result: CommandResult | null = await (usingJre ? runValidatorJRE(fileName) : runValidatorDocker(fileName));

    if (fs.existsSync(tempFileName)) {
        log.debug(`deleting temp file ${tempFileName}`);
        fs.rmSync(tempFileName);
    }

    // null returned if validator failed before validation actually checked
    if (result === null) return log;

    // if everything is ok, return
    if (result && /Information: All OK/.test(result?.stdout)) return log;

    const errors = result?.stdout.match(/(?<=\n\s*Error @ ).+/g) || [];
    errors.forEach(err => {
        const formattedError = err; // splitLines(err);
        log.error(formattedError, ErrorCode.FHIR_VALIDATOR_ERROR);
    });

    const warnings = result?.stdout.match(/(?<=\n\s*Warning @ ).+/g) || [];
    warnings.forEach(warn => {
        const formattedError = warn; // splitLines(warn);
        log.warn(formattedError, ErrorCode.FHIR_VALIDATOR_ERROR);
    });

    // if there are no errors or warnings but the validation is not 'All OK'
    // something is wrong.
    if (!errors && !warnings) {
        log.error(`${fileName} : failed to find Errors or 'All OK'`);
    }

    return log;
}


const JRE = {

    isAvailable: (): boolean => {
        const result = runCommandSync(`java -version`, log);
        if (result.exitCode === 0) {
            const version = /^(java \d+.+|openjdk version "\d+.+)/.exec(result.stdout || result.stderr)?.[0] ?? 'unknown';
            log?.debug(`Java detected : ${version}`);
        }

        return result.exitCode === 0;
    }

}


const Docker = {

    isAvailable: (): boolean => {
        const result = runCommandSync(`docker --version`, log);
        if (result.exitCode === 0) {
            const version = /^Docker version \d+.+/.exec(result.stdout)?.[0] ?? 'unknown';
            log?.debug(`Docker detected : ${version}`);
        }
        return result.exitCode === 0;
    },

    imageExists: async (imageName: string): Promise<boolean> => {
        return (await runCommand(`docker image inspect ${imageName}`, `Check Docker image ${imageName} exists`, log)).exitCode === 0;
    },

    containerExists: async (name: string): Promise<boolean> => {
        const stdout = (await runCommand(`docker ps -a --format '{{.Names}}'`, undefined, log)).stdout;
        const names: string[] = stdout.replace(/'/g, '').split('\n');
        return names.includes(name);
    },

    checkPermissions: async (): Promise<boolean> => {
        const result = await runCommand(`docker image ls`, undefined, log);
        if (result.exitCode !== 0) {
            if (/permission denied/.test(result.stderr)) {
                log.error(
                    `Selecting the '--validator fhirvalidator' option is attempting to run the HL7 FHIR Validator using a Docker image. However, Docker on this system requires elevated permissions to use. Run this tool as an elevated user or add yourself to the 'docker' group. See README.md for additional information.`,
                    ErrorCode.DOCKER_PERMISSIONS
                );
            } else if (/docker daemon is not running/.test(result.stderr)) {
                log.error(
                    `Selecting the '--validator fhirvalidator' option is attempting to run the HL7 FHIR Validator using a Docker image. However, Docker may not be running. See README.md for additional information.`,
                    ErrorCode.DOCKER_DAEMON_NOT_RUNNING
                );
            } else {
                log.error(
                    `Docker command failed ${result.stderr}`,
                    ErrorCode.DOCKER_ERROR
                );
            }
        }
        return result.exitCode === 0;
    },

    cleanupImage: async (imageName: string): Promise<void> => {
        log && log.debug(`Remove Docker image ${imageName}`);
        await runCommand(`docker image rm -f ${imageName}`, `Remove Docker image ${imageName}`, log);
    },

    buildImage: async (dockerFile: string, imageName: string): Promise<boolean> => {

        if (!fs.existsSync(dockerFile)) {
            log.error(`Cannot find Dockerfile ${dockerFile}`);
            return false;
        }

        log.debug(`Building Docker image ${imageName} from ${dockerFile}`);

        const result = await runCommand(`docker build -t ${imageName} -f ${dockerFile} .`, `Build Docker image ${imageName} from ${dockerFile}`, log);

        if (result.exitCode === 0 && await Docker.imageExists(imageName)) {
            log.debug(`Docker image ${imageName} created.`);
        } else {
            log.debug(`Failed to build image ${imageName}`);
            return false;
        }

        // docker returns build steps on stderr
        log.debug(result.stdout || result.stderr);

        return result.exitCode === 0;
    }

}


export function jreOrDockerAvailable(): boolean {
    return JRE.isAvailable() || Docker.isAvailable();
}
