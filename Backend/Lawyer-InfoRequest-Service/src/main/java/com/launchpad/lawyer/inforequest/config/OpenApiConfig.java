package com.launchpad.lawyer.inforequest.config;

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
    public OpenAPI infoRequestServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Lawyer Information Request Microservice API")
                        .description("Microservice managing information and document requests, deadlines, and submission statuses between lawyers and clients.")
                        .version("1.0.0")
                        .contact(new Contact().name("Launchpad AI").email("support@launchpad.ai")))
                .servers(List.of(
                        new Server().url("http://localhost:8085").description("Local Development Server")
                ));
    }
}

