package com.launchpad.lawyer.message.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

// Pas de url= : Feign résout "lawyer-client-service" dans Eureka (équilibrage via Spring Cloud LoadBalancer)
@FeignClient(name = "lawyer-client-service")
public interface ClientServiceClient {

    record ClientDto(
            Long id,
            String lawyerId,
            String firstName,
            String lastName,
            String fullName,
            String email,
            String phone,
            String company,
            String status
    ) {}

    @GetMapping("/api/lawyer/clients/{id}")
    ClientDto getClientById(
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable("id") Long id
    );
}

