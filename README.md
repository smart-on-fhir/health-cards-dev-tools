![Node.js CI](https://github.com/smart-on-fhir/health-cards-dev-tools/actions/workflows/node.js.yml/badge.svg)

# SMART Health Cards Dev Tools

This project provides tools to help implementers of the [SMART Health Card Framework](https://smarthealth.cards/) validate the artifacts they produce. The package's version number, currently `1.2.1-1`, matches the [specification version](https://smarthealth.cards/changelog/) the tool validates.

**NOTE: The goal of the project is to help implementers verify that their implementations conform to the specification. It optimistically tries to validate as much of the input artifacts as it can, continuing validation after encountering errors in order to give a complete validation report. It is therefore _not_ meant to robustly validate actual SMART Health Cards; applications validating such cards must be thoroughly tested using an adversarial threat model.**

## Setup

The developer tools can be installed directly from github, or built from source.

### Prerequisites

Make sure [node.js](https://nodejs.org/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed on your system; the latest Long-Term Support (LTS) version is recommended for both (note that node v16 is not currently supported). [OpenSSL 1.1.1](https://www.openssl.org/) is also needed to validate certificate chains which could be present in issuer JSON Web Keys (`x5c` value); if absent, chain validation is skipped.

### Install via Github

Install the latest version using:
```
npm install github:smart-on-fhir/health-cards-dev-tools
```

Install a specific version by specifying it as a parameter; for example, to obtain v1.2.1-1:
```
npm install github:smart-on-fhir/health-cards-dev-tools#v1.2.1-1
```

  **Note : Performing an npm global install from GitHub _npm install -g github:smart-on-fhir/health-cards-dev-tools_ does not currently work correctly with the latest version of [npm](https://github.com/npm/cli/issues/3692#issue-981406464) (version 7.x).  
  The combination of using both the `bin` and `prepare` properties in `package.json` is resulting in a failed install (It works correctly with npm 6.x).**  


### Build from source

Alternatively, the package can be built from source following these steps.

1. Get the source, for example using git:

    ```bash
    git clone -b main https://github.com/smart-on-fhir/health-cards-dev-tools.git
    cd health-cards-dev-tools
    ```

1. Build the npm package:

    ```bash
    npm install
    npm run build
    ```

1. Optionally, run the tests:

    ```bash
    npm test
    ```

### Run in Docker
Once obtained, the tools can be run in Docker following these steps:

```json
docker build -t health-cards-dev-tools .

docker run --rm -it \
  -v /path/to/inputs:/inputs health-cards-dev-tools /bin/bash
```

### Setup notes

The tests download and validate, among other things, the spec [examples](https://smarthealth.cards/examples/). A breaking spec change might invalidate the downloaded examples, which can be refreshed using:

  ```bash
  npm run fetch-examples -- --force
  ```

The tool can be updated to the latest version by running (assuming you obtained it with git):

  ```bash
  npm run update-validator
  ```

The tool can be packaged (and later installed into another npm project with `npm install <path to .tgz>`) using:

  ```bash
  npm pack
  ```

## Using the tool

To validate health card artifacts, use the `shc-validator.ts` script, or simply call `node .` from the package root directory, using the desired options:

    Usage: health-cards-dev-tools [options]
    
    Options:
      -v, --version                display specification and tool version
      -p, --path <path>            path of the file(s) to validate. Can be repeated for the qr and qrnumeric types, to provide multiple file chunks (default: [])
      -t, --type <type>            type of file to validate
                                   (choices: "fhirbundle", "jwspayload", "jws", "healthcard", "fhirhealthcard", "qrnumeric", "qr", "jwkset")
      -l, --loglevel <loglevel>    set the minimum log level (choices: "debug", "info", "warning", "error", "fatal", default: "warning")
      -P, --profile <profile>      vaccination profile to validate (choices: "any", "usa-covid19-immunization", default: "any")
      -V, --validator <validator>  FHIR bundle validator (choices: "default", "fhirvalidator" (requires Java runtime or Docker)) 
      -d, --directory <directory>  trusted issuer directory to validate against
      -o, --logout <path>          output path for log (if not specified log will be printed on console)
      -f, --fhirout <path>         output path for the extracted FHIR bundle
      -k, --jwkset <key>           path to trusted issuer key set
      -e, --exclude <error>        error to exclude, can be repeated, can use a * wildcard. Valid options: "openssl-not-available", "invalid-issuer-url", 
                                   "invalid-key-x5c", "invalid-key-wrong-kty", "invalid-key-wrong-alg",
                                   "invalid-key-wrong-use", "invalid-key-wrong-kid", "invalid-key-schema", "not-yet-valid", "fhir-schema-error", 
                                   "issuer-key-download-error", "unbalanced-qr-chunks", "jws-too-long",
                                   "invalid-file-extension", "trailing-characters", "issuer-wellknown-endpoint-cors" (default: [])
      -h, --help                   display help for command

### Examples

To validate a SMART Health Card `data.smart-health-card` file, call:

    node . --path data.smart-health-card --type healthcard

To validate a QR image `QR.png` file, call:

    node . --path QR.png --type qr

### Option details

* Multiple `path` options can be provided for QR artifacts (`qrnumeric` and `qr` types) split in multiple files, one for each chunk. For example, to validate a numeric QR code split in three chunks `QR1.txt`, `QR2.txt`, `QR3.txt`, call:

      node . --path QR1.txt --path QR2.txt --path QR3.txt --type qrnumeric

* Specific FHIR profiles can be validated by using the `--profile` option; valid options are:
  - `usa-covid19-immunization`, checking for vaccine products approved in the USA.

* A trusted issuers directory can be used by using the `--directory` option; by passing either a known directory name or by passing a URL pointing to a directory using the same format as the [VCI directory](https://raw.githubusercontent.com/the-commons-project/vci-directory/main/vci-issuers.json). The known directory names are:
   - `VCI`, corresponding to the VCI directory, and
   - `test`, a directory containing test issuers, including the one for the SMART Health Card specification examples.

* The log output can be stored into a file using the `--logout` option. The extracted FHIR bundle can be stored into a file using the `--fhirout` option.

* The supported file types, as expressed with the `--type` option, are:
   - *fhirbundle*: a JSON-encoded FHIR bundle
   - *jwspayload*: a JSON Web Signature (JWS) payload, encoding a health card
   - *jws*: a (signed) JSON Web Signature (JWS), encoding a health card
   - *healthcard*: a health card file
   - *fhirhealthcard*: response payload returned from a FHIR `$health-cards-issue` operation
   - *qrnumeric*: a numeric QR code encoding a health card
   - *qr*: a QR code image encoding a health card
   - *jwkset*: a JSON Web Key (JWK) Set, encoding the issuer public signing key. This supersedes downloading the key from the well-known location.

* The tool outputs validation information, depending on the verbosity level, in particular, the parsed FHIR bundle is printed at the `info` verbosity log level. The tool tries to continue parsing the artefact even if a warning or error occurred. Certain errors can be suppressed from the output using the `--exclude` option (using the full error name or a * wildcard character).

* Issuer signing public keys (encoded in a JSON Web Key Set) can be validated before being uploaded to their well-known URL. To validate a `issuerPublicKeys.json` JSON Web Key Set (JWK), call:

      node . --path issuerPublicKeys.json --type jwkset

` `  
` `  
## Programmatic API

The tool can be invoked programmatically from a Node.js app (*note: browser-based environments are not currently supported*). First, install the tool in your own project, either from  GitHub via `npm install smart-on-fhir/health-cards-dev-tools`, or from a local .tgz file resulting from `npm pack` as described above. Then import `src/api.js` and call the right `validate.<artifact-type>` method, where `<artifact-type>` can be one of `qrnumeric`, `healthcard`, `fhirhealthcard`, `jws`, `jwspayload`, `fhirbundle`, or `keyset`. The validation results, if any, are returned in Promise-wrapped array. For example you could check a JWS via:

```js
import { validate } from 'health-cards-dev-tools/js/src/api.js'
const jwsString = 'eyJ6aXAiOiJ...';
const results = validate.jws(jwsString);
results.then(console.log)
```  


The validation methods will take an optional __options__ object to pass additional parameters mirroring the command line options:
```js
const results = validate.jws(jwsString, {logOutputPath: '/mypath/mylogfile.json' /*write log to this file*/});
```  
 
| option                | example                                        |                                                                                                                    |
| :-------------------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **logLevel**:         | LogLevel.Debug                                 | set the minimum log level to Debug                                                                                 |
| **profile**:          | ValidationProfiles['usa-covid19-immunization'] | vaccination profile to validate                                                                                    |
| **issuerDirectory**:  | issuerDirectory: 'VCI'                         | trusted issuer directory to validate against                                                                       |
| **clearKeyStore**:    | true                                           | clears the keystore of keys from previous API calls                                                                |
| **cascade**:          | false                                          | stops validating child artifacts (e.g. validating a 'jwspayload' will not also validate the contained FHIR bundle) |
| **logOutputPath**:    | '/somepath/mylog.json'                         | where to output the logfile                                                                                        |
| **skipJwksDownload**: | false                                          | prevents JWK key download from the issuer                                                                          |
| **jwkset**:           | '/somepath/mykeys.json'                        | path to import a JWK keyset                                                                                        |
| **validator**:        | Validators.fhirvalidator                       | optionally validate the fhirbundle with the HL7 FHIR Validator                                                     |

` `  
` `  
## HL7 FHIR Validation (experimental)

Validation of the FHIR bundle is currently not comprehensive. The tool validates a subset of the full FHIR schema; the behavior can be scoped by using the `--profile` option, or changed by modifying the `src/prune-fhir-schema.ts` script. Extensive tests and conformance to the [Vaccination & Testing Implementation Guide](http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/) can be performed using the [FHIR validator](https://wiki.hl7.org/Using_the_FHIR_Validator) tool.

__This tool can now apply the HL7 FHIR Validator__, in place of the limited default validator, with the use of the `--validator fhirvalidator` option.  The HL7 FHIR Validator is a Java application and so requires a Java runtime (JRE), or alternatively, Docker to be installed on your system. 
This tool will attempt to run it with an installed JRE first, if available. If not, it will attempt to instantiate a Docker image (with a JRE). If neither method succeeds, an error will be returned.

__Note__: The HL7 FHIR Validator runs in another process, using the installed Java runtime, and downloads several files while initializing. These operations may not succeed on all platforms and configurations. So for now, this feature is considered __experimental__.

__Note__: The HL7 FHIR Validator can take up to 30-seconds to complete its analysis.

__Note__: Docker may require elevated permissions to execute docker commands, requiring this tool to also run with elevated permissions when attempting to use a Docker image. For example:
```
# Run shc-validator as sudo ('-E env "PATH=$PATH"' preserves the environment of the current user)
sudo -E env "PATH=$PATH" shc-validator --path myfhirbundle.json --type fhirbundle --validator fhirvalidator
```