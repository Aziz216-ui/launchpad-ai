package com.example.gateway.web;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;

import reactor.core.publisher.Mono;

/** Écriture des réponses d'erreur JSON de la gateway (401, 503). */
public final class JsonResponses {

    private JsonResponses() {
    }

    public static Mono<Void> write(ServerHttpResponse response, HttpStatus status, Map<String, String> body) {
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] json = toJson(body).getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = response.bufferFactory().wrap(json);
        return response.writeWith(Mono.just(buffer));
    }

    /** Objet JSON plat ; l'ordre des clés est celui de la Map. */
    static String toJson(Map<String, String> body) {
        return body.entrySet().stream()
                .map(e -> quote(e.getKey()) + ":" + quote(e.getValue()))
                .collect(Collectors.joining(",", "{", "}"));
    }

    private static String quote(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }
}
