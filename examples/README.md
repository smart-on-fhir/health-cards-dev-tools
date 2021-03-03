Examples from https://smarthealth.cards/examples/. Run `npm run fetch-examples` to retrieve them.

Each example contains the following data element:
 * a: a fhir bundle, currently imported from http://build.fhir.org/ig/dvci/vaccine-credential-ig/branches/main/
 * b: a pre-signed verifiable credential payload containing the fhir bundle from `a`
 * c: object from `b`, but minified
 * d: a Java Web Signature (JWS) object containing the signed payload from `d`, using a fixed issuer key
 * e: a SMART Health Card file, containing the object from `d`
 * d: numeric qr-code encoding of `e`
 * f: svg qr-code encoding of `d`