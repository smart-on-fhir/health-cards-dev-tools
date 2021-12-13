FROM fabric8/java-alpine-openjdk11-jre

RUN java -version

RUN curl -L -o validator_cli.jar https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar

# Run the validator to cache the fhir downloads.  "|| :"  forces a '0' exit code as the validator with thrown when doing no actual validation
RUN java -jar validator_cli.jar -ig hl7.fhir.r5.core#current || :
