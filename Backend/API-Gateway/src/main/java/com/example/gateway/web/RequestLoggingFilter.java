package com.example.gateway.web;

import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

/**
 * Filtre global : une ligne de log par requête (méthode, chemin, statut, durée) et
 * en-tête X-Request-Id.
 *
 * L'identifiant reçu est conservé (sinon un UUID est créé), transmis au service
 * appelé et renvoyé dans la réponse. Filtre WebFlux placé avant la sécurité : il voit
 * aussi les réponses 401, les préflights CORS, les 503 et l'actuator.
 */
@Component
public class RequestLoggingFilter implements WebFilter, Ordered {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);
    // Identifiant fourni par le client : accepté seulement s'il est court et sans caractère spécial
    private static final Pattern VALID_ID = Pattern.compile("[A-Za-z0-9._-]{1,128}");

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        long start = System.nanoTime();
        String received = exchange.getRequest().getHeaders().getFirst(REQUEST_ID_HEADER);
        String requestId = received != null && VALID_ID.matcher(received).matches()
                ? received : UUID.randomUUID().toString();

        ServerHttpRequest request = exchange.getRequest().mutate()
                .headers(h -> h.set(REQUEST_ID_HEADER, requestId))
                .build();
        ServerWebExchange mutated = exchange.mutate().request(request).build();

        // Au moment de l'envoi de la réponse : le statut final est connu (y compris 401 / 503)
        ServerHttpResponse response = mutated.getResponse();
        response.beforeCommit(() -> {
            response.getHeaders().set(REQUEST_ID_HEADER, requestId);
            long ms = (System.nanoTime() - start) / 1_000_000;
            log.info("{} {} -> {} ({} ms) [{}]", request.getMethod(), request.getPath().value(),
                    response.getStatusCode() != null ? response.getStatusCode().value() : 200, ms, requestId);
            return Mono.empty();
        });
        return chain.filter(mutated);
    }
}
