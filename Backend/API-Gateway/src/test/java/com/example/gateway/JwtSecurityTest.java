package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Date;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/**
 * JWT_ENABLED=true : un faux Keycloak publie ses clés (JWKS) et le faux Market-Service
 * répond sur tout le reste. Les tokens sont de vrais JWT RS256.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = "launchpad.security.jwt-enabled=true")
@ActiveProfiles("local")
class JwtSecurityTest extends GatewayTestSupport {

    static final RSAKey keycloakKey = generateKey("keycloak");
    static final RSAKey otherKey = generateKey("autre");

    static final String JWKS_PATH = "/realms/launchpad/protocol/openid-connect/certs";

    /** Sert le JWKS sur JWKS_PATH, et joue le Market-Service ailleurs. */
    static final MockService keycloakAndMarket = new MockService(request -> JWKS_PATH.equals(request.getPath())
            ? MockService.json(200, new JWKSet(keycloakKey.toPublicJWK()).toString())
            : MockService.json(200, "{\"chemin\":\"" + request.getPath() + "\"}"));

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri",
                () -> keycloakAndMarket.url() + JWKS_PATH);
        registry.add("launchpad.services.market.uri", keycloakAndMarket::url);
        registry.add("launchpad.services.accounting.uri", keycloakAndMarket::url);
        registry.add("launchpad.services.legal.uri", keycloakAndMarket::url);
        registry.add("launchpad.services.user.uri", keycloakAndMarket::url);
    }

    @BeforeEach
    void clear() {
        keycloakAndMarket.clear();
    }

    @Test
    void protectedRouteWithoutTokenGives401Json() {
        client.get().uri("/api/market/etudes/").exchange()
                .expectStatus().isUnauthorized()
                .expectBody().json("{\"message\":\"Token manquant ou invalide\"}", JsonCompareMode.STRICT);
    }

    @Test
    void the401KeepsCorsHeadersForTheFrontend() {
        client.get().uri("/api/market/etudes/").header(HttpHeaders.ORIGIN, "http://localhost:4200").exchange()
                .expectStatus().isUnauthorized()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200");
    }

    @Test
    void tokenSignedByAnotherKeyGives401() {
        client.get().uri("/api/market/etudes/").headers(h -> h.setBearerAuth(token(otherKey, 300))).exchange()
                .expectStatus().isUnauthorized()
                .expectBody().jsonPath("$.message").isEqualTo("Token manquant ou invalide");
    }

    @Test
    void expiredTokenGives401() {
        client.get().uri("/api/market/etudes/").headers(h -> h.setBearerAuth(token(keycloakKey, -300))).exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void validKeycloakTokenIsAcceptedAndForwardedUnchanged() {
        String jwt = token(keycloakKey, 300);
        client.get().uri("/api/market/etudes/").headers(h -> h.setBearerAuth(jwt)).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.chemin").isEqualTo("/api/market/etudes/");

        assertThat(lastServiceRequestAuthorization()).isEqualTo("Bearer " + jwt);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/auth/login",
            "/api/market/docs/", "/api/market/schema/",
            "/api/comptable/docs", "/api/comptable/docs.json",
            "/docs/legal", "/docs/legal-json",
            "/api/market/health/", "/api/comptable/health",
    })
    void publicRoutesNeedNoToken(String path) {
        client.get().uri(path).exchange().expectStatus().isOk();
    }

    @Test
    void invalidTokenIsIgnoredOnPublicRoutesButStillForwarded() {
        client.get().uri("/api/market/health/").headers(h -> h.setBearerAuth("pas-un-jwt")).exchange()
                .expectStatus().isOk();
        assertThat(lastServiceRequestAuthorization()).isEqualTo("Bearer pas-un-jwt");
    }

    @Test
    void actuatorHealthIsPublicButRoutesListIsProtected() {
        client.get().uri("/actuator/health").exchange().expectStatus().isOk();
        client.get().uri("/actuator/gateway/routes").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void corsPreflightNeedsNoToken() {
        client.options().uri("/api/market/etudes/")
                .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200");
    }

    /** En-tête Authorization reçu par le faux service (hors appels JWKS de la gateway). */
    private String lastServiceRequestAuthorization() {
        var request = keycloakAndMarket.lastRequest();
        assertThat(request.getPath()).isNotEqualTo(JWKS_PATH);
        return request.getHeader(HttpHeaders.AUTHORIZATION);
    }

    private static String token(RSAKey key, long secondsUntilExpiry) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject("entrepreneur-101")
                    .issuer("http://localhost:8080/realms/launchpad")
                    .issueTime(new Date())
                    .expirationTime(Date.from(Instant.now().plusSeconds(secondsUntilExpiry)))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
            jwt.sign(new RSASSASigner(key));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    private static RSAKey generateKey(String keyId) {
        try {
            return new RSAKeyGenerator(2048).keyID(keyId).generate();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }
}
