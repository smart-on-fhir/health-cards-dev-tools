# CHANGE LOG

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
 - Scoped FHIR schema parsing to improve valitation time
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
