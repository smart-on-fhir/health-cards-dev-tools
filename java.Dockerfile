# Smallish Linux with JRE to run the FHIR-validator
FROM fabric8/java-alpine-openjdk11-jre

# Download the validator jar file when creating the image
RUN curl -L -o validator_cli.jar https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
