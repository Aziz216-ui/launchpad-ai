# Image du Config Server LaunchPad AI (Java 17, Spring Cloud Config Server)

# --- Étape 1 : compilation avec Maven ------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
COPY config-repo ./config-repo
# Les tests lisent config-repo/ : ils tournent pendant la construction de l'image
RUN mvn -B -q package

# --- Étape 2 : exécution (JRE seul) --------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app

RUN groupadd --system config && useradd --system --gid config config
COPY --from=build /build/target/config-server-*.jar app.jar
# Configuration par défaut (docker-compose monte config-repo/ par-dessus, en lecture seule)
COPY config-repo /config-repo
ENV CONFIG_REPO_LOCATION=file:/config-repo/
USER config

EXPOSE 8888
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
