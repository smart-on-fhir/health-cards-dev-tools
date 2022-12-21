# CHANGE LOG
## v1.3.0-0
- Updated dev tools version to match new spec version
- Depricated multi-part chunking support

## v1.2.2-1
- Added support to decode and validate SMART Health Links and its artifacts

## v1.2.2-0
- Updated dev tools version to match new spec version (with new examples)

## v1.2.1-3
- Added validation time option for SHC and X.509 certs
- Updated CVX Covid19 codes
- Dependencies update

## v1.2.1-2
- Check for duplicated RID in revocation lists
- Check JWK curve
- Dependencies update

## v1.2.1-1
- Add HL7 FHIR validator support
- Dependencies update

## v1.2.1-0
 - Add support for SHC expiration
 - Minor updates to logger

## v1.2.0-0
 - Add support for SHC revocation
 - Add image scaling to assist QR decoding

## v1.1.1-3
 - Add additional Pfizer formulations cvx codes
 - Check for BOM prefix in UTF8 JWS payload
 - More strict enforcement of FHIR reference format
 - Always require occurrence(DateTime|String) properties in Immunization entry
 - Update package dependencies and removal of unused packages
 - Update package-lock lockfileVersion to 2

## v1.1.1-2
 - Now require `Immunization.status === 'completed'` within fhirBundle

## v1.1.1-1
 - Updated package dependencies to remove npm flagged 'high' vulnerabilities

## v1.1.1-0
 - Followed spec version change to v1.1.1
 - Fixed non-chunked QR max size check

## v1.1.0-0
 - Followed spec version change to v1.1.0
 - Promoted extra white spaces warnings to errors
 - Added more covid CVX codes
 - Added support for direct npm install
 - Misc fixes and README.md improvements

## v1.0.2-0
 - Followed spec version change to v1.0.2
 - Renamed project to health-cards-dev-tools
 - Added check to verify issuer `kid` in card matches one in JWKS
 - Added ability to reset keystore

## v1.0.1-0
 - Followed spec version change to v1.0.1
 - Promoted CORS response warnings to errors
 - Added option to validate against a trusted issuers directory
 - Added check for inflated QR codes
 - Added API tests and misc fixes

## v1.0.0-4
 - Added checks for health card verifiable credential types
 - Support for multi-QR scans in API
 - Added new fhirhealthcard validation type
 - Misc fixes and refactoring

## v1.0.0-3
 - Updated test files after spec location change
 - Added support for node 16

## v1.0.0-2
 - Check unnecessary QR split
 - Debug log QR segments' type and content
 - Added validation profile to api
 - Simplified schema error reporting

## v1.0.0-1
 - Added validation profile option
 - Added support for multi-JWS cards
 - Extended x5c validation to platform with libressl and older openssl

## v1.0.0-0
 - Followed spec version change to v1.0.0
 - Scoped FHIR schema parsing to improve validation time
 - Check CORS response when fetching issuer keys

## v0.4.5-3
 - Added wildcard error exclusion
 - Added npm packing and preparation for redistribution
 - Single segment QR test

## v0.4.5-2
 - Check QR version
 - JWS header validation
 - Misc improvements

## v0.4.5-1
 - Added support for spec v0.4.5 (Clarify mapping into VC Data Model, and strip "fixed" fields from payload)
 - Skip JWK set download if provided on command-line
 - Misc improvements

## v0.4.4-1
 - Added support for spec v0.4.4 (Resource.meta is allowed in one special case)
 - Introduced prerelease version and update notification
 - Added error suppression
 - Misc improvements

## v0.4.3
 - Added support for spec v0.4.3 (Document CORS expectation for .well-known/jwks.json)

## v0.4.2
 - Added support for spec v0.4.2 (Replace iat with nbf in JWT payload encoding)

## v0.4.1
 - Added support for spec v0.4.1 (support for x5c JWK set X.509 chain validation)

## v0.3.1
 - Added support for spec v0.3.1

## v0.2.0
 - Added support for spec v0.2.0 (multi-chunk QR codes)
