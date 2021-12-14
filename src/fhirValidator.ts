import execa, { ExecaChildProcess, ExecaReturnValue } from 'execa';
import fs from 'fs';
import path from 'path';
import Log, { note } from '../src/logger';
import { ErrorCode } from './error';
import color from 'colors';
import got from 'got';

// use a global log
let log: Log;

const imageName = 'java.docker.image';
const dockerFile = 'java.Dockerfile';
const validatorJarFile = 'validator_cli.jar';
const validatorUrl = 'https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar';


async function downloadFHIRValidator(): Promise<void> {
    try {
        fs.writeFileSync(validatorJarFile, (await got(validatorUrl, { followRedirect: true }).buffer()));
    } catch (err) {
        log.debug(`File download error ${(err as Error).toString()}`);
    }
}


function workingAnnimation(message: string, interval = 200) {
    const chars = ['|', '/', '―', '\\']; //['\u{2819}', "⠙", "⠘", "⠰", "⠴", "⠤", "⠦", "⠆", "⠃", "⠋", "⠉"]; //- doesn't work on CMD/Powershell windows
    let x = 0;

    const handle = setInterval(() => {
        process.stdout.write(`\r ${color.green(chars[x++])} ${message}`);
        x %= chars.length;
    }, interval);

    return {
        stop: () => {
            clearInterval(handle);
            process.stdout.clearLine(0);
            process.stdout.write('\n');
        }
    }
}


async function runCommand(command: string, message?: string): Promise<ExecaChildProcess<string>> {

    let result;
    const start = Date.now();

    const annimation = workingAnnimation(message || command);

    try {
        result = await execa.command(command);
    } catch (failed) {
        result = failed as ExecaReturnValue<string>;
    }

    // stop the annimation timer
    annimation.stop();

    // output some results of the execa command
    log?.debug(
        `Running command : ${command}\n \
duration: ${((Date.now() - start) / 1000).toFixed(2)} seconds\n  \
exitcode : ${result.exitCode}\n  \
stdout: ${result.stdout.split('\n').join("\n          ")}\n  \
stderr: ${result.stderr.split('\n').join("\n          ")}`);

    return result;
}


// Runs the FHIR validator using the installed JRE
async function runValidatorJRE(artifactPath: string): Promise<ExecaReturnValue<string> | null> {

    if (!fs.existsSync(validatorJarFile)) await downloadFHIRValidator();

    if (!fs.existsSync(validatorJarFile)) {
        log.error(`Failed to download FHIR Validator Jar file ${validatorJarFile} from ${validatorUrl}`);
        return null;
    }

    log.info(`Validating ${artifactPath} with FHIR validator.`);

    const result = await runCommand(`java -jar ${validatorJarFile} ${artifactPath}`, `Running FHIR-validator with JRE`);

    return result;
}

// Runs the FHIR validator using a Docker image
async function runValidatorDocker(artifactPath: string): Promise<ExecaReturnValue<string> | null> {

    if (!await Docker.checkPermissions()) return null;

    if (!await Docker.imageExists(imageName)) {
        log.debug(`Image ${imageName} not found. Attempting to build.`);
        if (!await Docker.buildImage(dockerFile, imageName)) {
            log.error('Could not build Docker image.');
            return null;
        }
    }

    const dockerCommand = `java -jar validator_cli.jar ${artifactPath}`;

    log.info(`Validating ${path.resolve(artifactPath)} with FHIR validator.`);

    const command = `docker run --mount type=bind,source=${path.resolve(artifactPath)},target=/${artifactPath} ${imageName} ${dockerCommand}`;

    const result = await runCommand(command, `Running FHIR-validator with Docker (${imageName})`);

    return result;
}


export async function validate(fileOrJSON: string, logger = new Log('FHIR Validator')): Promise<Log> {

    log = logger;

    //note(`The FHIR-Validator may take additional time to run its validations.\n`);

    if (!await Docker.isAvailable() && !await JRE.isAvailable()) {
        return log.error(`Validator: use of option ${color.italic('--validator fhir-validator')} requires Docker or JRE to execute the FHIR Validator Java application.  See: http://hl7.org/fhir/validator/`);
    }

    const tempFileName = 'temp.fhirbundle.json';

    if (JSON.parse(fileOrJSON)) {
        fs.writeFileSync(tempFileName, fileOrJSON);  // overwrites by default
        fileOrJSON = tempFileName;
    }

    let result: ExecaReturnValue<string> | null;

    const artifact = path.resolve(fileOrJSON);

    if (!fs.existsSync(artifact)) {
        return log.error(`Artifact ${artifact} not found.`);
    }

    const fileName = path.basename(artifact);

    if (await JRE.isAvailable()) {  // try with existing jre

        result = await runValidatorJRE(fileName);

    } else if (await Docker.isAvailable()) {  // try with docker image w/ jre

        result = await runValidatorDocker(fileName);

    } else {
        return log.error(`JRE or Docker required to run FHIR Validator Java application. See README.md.`);
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

    // if there are no errors or warnings but the validaiton is not 'All OK'
    // something is wrong.
    if (!errors && !warnings) {
        log.error(`${fileName} : failed to find Errors or 'All OK'`);
    }

    return log;
}


const JRE = {

    isAvailable: async (): Promise<boolean> => {
        const result = await runCommand(`java --version`, `Check if JRE is available`);
        if (result.exitCode === 0) {
            const version = /^java \d+.+/.exec(result.stdout)?.[0] ?? 'unknown';
            log?.debug(`Java detected : ${version}`);
        }

        return result.exitCode === 0;
    }

}


const Docker = {

    // check if Docker is installed
    isAvailable: async (): Promise<boolean> => {
        const result = await runCommand(`docker --version`, `Check if Docker is available`);
        if (result.exitCode === 0) {
            const version = /^Docker version \d+.+/.exec(result.stdout)?.[0] ?? 'unknown';
            log?.debug(`Docker detected : ${version}`);
        }
        return result.exitCode === 0;
    },

    imageExists: async (imageName: string): Promise<boolean> => {
        return (await runCommand(`docker image inspect ${imageName}`, `Check Docker image ${imageName} exists`)).exitCode === 0;
    },

    checkPermissions: async (): Promise<boolean> => {
        const result = await runCommand(`docker image ls`);
        if (result.exitCode !== 0) {

            if (/'permission denied'/.test(result.stderr)) {
                log.error(`Docker requires elevated permissions to use.\nRun this tool as an elevated user or add yourself to the 'docker' group. \n (i.e. sudo -E env "PATH=$PATH" shc-validator ... )`);
            } else {
                log?.debug(`Docker check failed ${result.stderr}`);
            }
        }
        return result.exitCode === 0;
    },

    cleanupImage: async (imageName: string): Promise<void> => {
        log && log.debug(`Remove Docker image ${imageName}`);
        await runCommand(`docker image rm -f ${imageName}`, `Remove Docker image ${imageName}`);
    },

    buildImage: async (dockerFile: string, imageName: string): Promise<boolean> => {

        if (!fs.existsSync(dockerFile)) {
            log.error(`Cannot find Dockerfile ${dockerFile}`);
            return false;
        }

        log.debug(`Building Docker image ${imageName} from ${dockerFile}`);

        const result = await runCommand(`docker build -t ${imageName} -f ${dockerFile} .`, `Build Docker image ${imageName} from ${dockerFile}`);

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
