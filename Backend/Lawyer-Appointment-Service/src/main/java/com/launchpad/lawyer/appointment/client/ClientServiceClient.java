package com.launchpad.lawyer.appointment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "lawyer-client-service", url = "${client-service.url:http://localhost:8082}")
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

