# --- Étape 1 : build Maven (JDK 17) ---
FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
# Les tests (dont Testcontainers) sont lancés hors conteneur par `mvn verify`.
RUN mvn -B -q package -DskipTests

# --- Étape 2 : exécution (JRE 17) ---
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 finance && mkdir -p /app/data/documents && chown -R finance /app
COPY --from=build /build/target/finance-service.jar app.jar
USER finance
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
