# Image du Lawyer-Message-Service LaunchPad AI (Java 21, Spring Boot)

# --- Étape 1 : compilation avec Maven ------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dépendances téléchargées dans une couche séparée (mise en cache tant que le pom ne change pas)
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

# --- Étape 2 : exécution (JRE seul) --------------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system lawyer && useradd --system --gid lawyer lawyer
COPY --from=build /build/target/lawyer-message-service-*.jar app.jar
USER lawyer

EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
