TODO
Assigned to (C)hristian, (L)arry, (K)aren, (?) Unassigned
Priority: P1 (needed for release), P2, P3, ...

*Dev*
- [ ] Validate schema for each artifact type (L) (P1)
- [ ] Clean-up code (exports, comments, etc.) (C/L) (P1)
- [ ] Address all TODOs in the code (keep, delete, fix) (?) (P1)
- [ ] Docker container to run the tool (C) (P3)
- [ ] Implement bundles (multiple VC per card) (C) (P2)
- [ ] Implement bundled QR code (C) (P2)
- [ ] Move unit tests etc. to dev dependencies of package.json (P2)

*Unit Tests*
- Tests schema for each file type (?) (P1)
- Write negative (warning) tests for each SHALL have in the spec (?)
   - [ ] Issuers SHALL publish keys as JSON Web Key Sets (see RFC7517), available at <<iss value from Signed JWT>> + .well-known/jwks.json (?) (P2) - how to test that?
   - [ ] SHALL be provided with a MIME type of application/smart-health-card (e.g., web servers SHALL include Content-Type: application/smart-health-card as an HTTP Response containing a Health Card) (?) (P2) (we can only test that if we provide a fetch API)
   - [ ] In a QR code, the the JWS string value SHALL be represented as two segments: (L) (P2)
      1. A segment encoded with bytes mode consisting of the fixed string shc:/
      2. A segment encoded with numeric mode consisting of the characters 0-9. 
- FHIR tests (?) (P2)
    - [ ] Connect to MITRE [validator](https://github.com/inferno-community/fhir-validator-wrapper) (P3)

*Release checklist*
- [ ] eslint everything
- [ ] Review README.md, SUPPORT.md
- [ ] Review dependencies to OSS release [tool](https://msrtcrypto.visualstudio.com/Security%20and%20Cryptography/_componentGovernance/176514?_a=components&typeId=-2) (C)
- [ ] grep for TODO and FIXME
- [ ] run tests from a fresh clone on Windows and Linux (and mac)