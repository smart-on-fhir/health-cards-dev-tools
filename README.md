![Node.js CI](https://github.com/microsoft/health-cards-validation-SDK/actions/workflows/node.js.yml/badge.svg)

# SMART Health Cards Validation SDK

This project provides a tool to help implementers of the [SMART Health Card Framework](https://smarthealth.cards/) validate the artifacts they produce. The package's version number, currently `0.4.5-3`, matches the [specification version](https://smarthealth.cards/changelog/) the tool validates.

## Setup

1. Make sure [node.js](https://nodejs.org/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) are installed on your system; the latest Long-Term Support (LTS) version is recommended for both (note that node v16 is not currently supported). [OpenSSL 1.1.1](https://www.openssl.org/) is also needed to validate certificate chains which could be present in issuer JSON Web Keys (`x5c` value); if absent, chain validation is skipped.

2. Get the source, for example using git:

                git clone -b main https://github.com/microsoft/health-cards-validation-SDK.git
                cd health-cards-validation-SDK

3. Build the npm package:

                npm install
                npm run build

3. Optionally, run the tests:

                npm test

The tests download and validate, among other things, the spec [examples](https://smarthealth.cards/examples/). A breaking spec change might invalidate the downloaded examples, which can be refreshed using:

                npm run fetch-examples -- --force

The tool can be updated to the latest version by running (assuming you obtained it with git):

                npm run update-validator

The tool can be packaged (and later installed into another npm project with `npm install <path to .tgz>`) using:

                npm pack

### Running in Docker

```json
docker build -t health-cards-validation .

docker run --rm -it \
  -v /path/to/inputs:/inputs \
  health-cards-validation /bin/bash
```

## Using the tool

To validate health card artifacts, use the `shc-validator.ts` script, or simply call `node .` from the package root directory, using the desired options:

                Usage: shc-validator [options]
                
                Options:
                  -v, --version              display specification and tool version
                  -p, --path <path>          path of the file(s) to validate. Can be repeated for the qr and qrnumeric types, to provide multiple file chunks (default: [])
                  -t, --type <type>          type of file to validate (choices: "fhirbundle", "jwspayload", "jws", "healthcard", "qrnumeric", "qr", "jwkset")
                  -l, --loglevel <loglevel>  set the minimum log level (choices: "debug", "info", "warning", "error", "fatal", default: "warning")
                  -o, --logout <path>        output path for log (if not specified log will be printed on console)
                  -f, --fhirout <path>       output path for the extracted FHIR bundle
                  -k, --jwkset <key>         path to trusted issuer key set
                  -e, --exclude <error>      error to exclude, can be repeated, can use a * wildcard. Valid options: "openssl-not-available",
                                             "invalid-issuer-url", "invalid-key-x5c", "invalid-key-wrong-kty", "invalid-key-wrong-alg",
                                             "invalid-key-wrong-use", "invalid-key-wrong-kid", "invalid-key-schema", "not-yet-valid",
                                             "fhir-schema-error", "issuer-key-download-error", "unbalanced-qr-chunks", "jws-too-long",
                                             "invalid-file-extension", "trailing-characters" (default: [])
                  -h, --help                 display help for command

For example, to validate a `data.smart-health-card` file, call:

                node . --path data.smart-health-card --type healthcard

To validate a `QR.png` file, call:

                 node . --path QR.png --type qr

Multiple `path` options can be provided for QR artifacts (`qrnumeric` and `qr` types) split in multiple files , one for each chunk. For example, to validate a numeric QR code split in three chunks `QR1.txt`, `QR2.txt`, `QR3.txt`, call:

                 node . --path QR1.txt --path QR2.txt --path QR3.txt --type qrnumeric

The log output can be stored into a file using the `--logout` option. The extracted FHIR bundle can be stored into a file using the `--fhirout` option.

The supported file types, as expressed with the `--type` option, are:
 - *fhirbundle*: a JSON-encoded FHIR bundle
 - *jwspayload*: a JSON Web Signature (JWS) payload, encoding a health card
 - *jws*: a (signed) JSON Web Signature (JWS), encoding a health card
 - *healthcard*: a health card file
 - *qrnumeric*: a numeric QR code encoding a health card
 - *qr*: a QR code image encoding a health card
 - *jwkset*: a JSON Web Key (JWK) Set, encoding the issuer public signing key. This superceedes downloading the key from the well-known location.

The tool outputs validation information, depending on the verbosity level, in particular, the parsed FHIR bundle is printed at the `info` verbosity log level. The tool tries to continue parsing the artefact even if a warning or error occurred. Certain errors can be suppressed from the output using the `--exclude` option (using the full error name or a * wildcard character).

Issuer signing public keys (encoded in a JSON Web Key Set) can be validated before being uploaded to their well-known URL. To validate a `issuerPublicKeys.json` JSON Web Key Set (JWK), call:

                node . --path issuerPublicKeys.json --type jwkset

The tool can be invoked programmatically. First, install the tool in your own project, either from  GitHub via `npm install microsoft/health-cards-validation-SDK`, or from a local .tgz file resulting from `npm pack` as described above. Then import `src/api.js` and call the right `validate.<artifact-type>` method, where `<artifact-type>` can be one of `qrnumeric`, `healthcard`, `jws`, `jwspayload`, `fhirbundle`, or `keyset`. The validation results, if any, are returned in Promise-wrapped array. For example you could check a JWS via:

```js
import { validate } from 'health-cards-validation-sdk/js/src/api.js'
const jwsString = 'eyJ6aXAiOiJ...';
const results = validate.jws(jwsString);
results.then(console.log)
```

## Validating tests

The tool currently verifies proper encoding of the:
 - QR code image (single file or split in chunks)
 - Numeric QR data (header, content)
 - SMART Health Card file (schema)
 - JWS (schema, deflate compression, format, size limits, signature, issuer key retrieval, x5c cert chain validation)
 - JWS payload (schema)
 - FHIR bundle (basic schema validation).
 - Issuer JSON Key Set (schema, algorithm, EC Curve, ID, type, usage)

Validation of the FHIR bundle is currently limited. The tool validates a subset of the full FHIR schema; the behavior can be changed by modifying the `srs/prune-fhir-schema.ts` script. Extensive tests and conformance to the [Vaccination & Testing Implementation Guide](http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/) can be performed by the [FHIR validator](https://wiki.hl7.org/Using_the_FHIR_Validator) tool.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
