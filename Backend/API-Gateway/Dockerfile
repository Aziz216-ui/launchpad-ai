# Image de l'API Gateway LaunchPad AI (Java 17, Spring Cloud Gateway)

# --- Étape 1 : compilation avec Maven ------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Dépendances téléchargées dans une couche séparée (mise en cache tant que le pom ne change pas)
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

# --- Étape 2 : exécution (JRE seul) --------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app

RUN groupadd --system gateway && useradd --system --gid gateway gateway
COPY --from=build /build/target/api-gateway-*.jar app.jar
USER gateway

EXPOSE 8090
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
