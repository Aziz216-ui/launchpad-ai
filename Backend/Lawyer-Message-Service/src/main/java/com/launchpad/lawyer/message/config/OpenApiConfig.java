package com.launchpad.lawyer.message.config;

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
    public OpenAPI messageServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Lawyer Message Microservice API")
                        .description("Microservice managing communication, messages, and unread notifications between lawyers and clients.")
                        .version("1.0.0")
                        .contact(new Contact().name("Launchpad AI").email("support@launchpad.ai")))
                .servers(List.of(
                        new Server().url("http://localhost:8084").description("Local Development Server")
                ));
    }
}

