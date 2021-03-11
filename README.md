# SMART Health Cards Validation SDK

This project provides a tool to help implementers of the [SMART Health Card Framework](https://smarthealth.cards/) validate the artifacts they produce. The package's version number, currently `0.2.0`, matches the [specification version](https://smarthealth.cards/changelog/) the tool validates.

## Setup

1. Make sure [node.js](https://nodejs.org/) is installed on your system. The latest LTS version (14.16.0) is recommended.

2. Get the source, for example using git:

                git clone -b main https://github.com/microsoft/health-cards-validation-SDK.git
                cd health-cards-validation-SDK

3. Build the npm package:

                npm install
                npm build

3. Optionally, run the tests:

                npm test

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
                  -k, --jwkset <key>         path to trusted issuer key set
                  -h, --help                 display help for command

For example, to validate a `data.smart-health-card` file, call:

                node . --path data.smart-health-card --type healthcard

To validate a `QR.png` file, call:

                 node . --path QR.png --type qr

Multiple `path` options can be provided for QR artifacts (`qrnumeric` and `qr` types) split in multiple files , one for each chunk. For example, to validate a numeric QR code split in three chunks `QR1.txt`, `QR2.txt`, `QR3.txt`, call:

                 node . --path QR1.txt --path QR2.txt --path QR3.txt --type qrnumeric

The supported file types, as expressed with the `--type` option, are:
 - *fhirbundle*: a JSON-encoded FHIR bundle
 - *jwspayload*: a JSON Web Signature (JWS) payload, encoding a health card
 - *jws*: a (signed) JSON Web Signature (JWS), encoding a health card
 - *healthcard*: a health card file
 - *qrnumeric*: a numeric QR code encoding a health card
 - *qr*: a QR code image encoding a health card
 - *jwkset*: a JSON Web Key (JWK) Set, encoding the issuer public signing key

The tool outputs validation information, depending on the verbosity level, in particular, the parsed FHIR bundle is printed at the `info` verbosity log level.  The tool tries to continue parsing the artefact even if a warning or error occurred.

Issuer signing public keys (encoded in a JSON Web Key Set) can be validated before being uploaded to their well-known URL. To validate a `issuerPublicKeys.json` JSON Web Key Set (JWK), call:

                node . --path issuerPublicKeys.json --type jwkset

## Validating tests

The tool currently verifies proper encoding of the:
 - QR code image and chunks
 - Numeric QR data (header, content, chunks)
 - SMART Health Card file (schema)
 - JWS (schema, deflate compression, format, size limits, signature, issuer key retrieval)
 - JWS payload (schema)
 - FHIR bundle (schema, conformance to the [Vaccination & Testing Implementation Guide](http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/)).
 - Issuer JSON Key Set (schema, algorithm, EC Curve, ID, type, usage)

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
