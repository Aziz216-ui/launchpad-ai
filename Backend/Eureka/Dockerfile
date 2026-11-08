# Image du serveur Eureka LaunchPad AI (Java 17, Spring Cloud Netflix Eureka)
# Ajouté pour que `docker compose --profile full-stack up --build` (qui référence
# ce Dockerfile) puisse réellement builder le registre de découverte.

# --- Étape 1 : compilation avec Maven ------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package

# --- Étape 2 : exécution (JRE seul) --------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app

RUN groupadd --system eureka && useradd --system --gid eureka eureka
COPY --from=build /build/target/eureka-*.jar app.jar
USER eureka

EXPOSE 8761
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
