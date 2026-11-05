package com.launchpad.lawyer.docreview.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI docReviewServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Lawyer Document Review Microservice API")
                        .description("Microservice managing document reviews, annotations, correction requests, and decisions between lawyers and clients.")
                        .version("1.0.0")
                        .contact(new Contact().name("Launchpad AI").email("support@launchpad.ai")))
                .servers(List.of(
                        new Server().url("http://localhost:8086").description("Local Development Server")
                ));
    }
}

