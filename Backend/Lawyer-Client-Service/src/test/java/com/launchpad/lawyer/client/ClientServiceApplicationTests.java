package com.launchpad.lawyer.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.client.dto.ClientRequestDto;
import com.launchpad.lawyer.client.dto.ClientResponseDto;
import com.launchpad.lawyer.client.entity.ClientStatus;
import com.launchpad.lawyer.client.repository.ClientRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.rabbitmq.listener.simple.auto-startup=false"
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ClientServiceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClientRepository clientRepository;

    private static Long clientId;

    @Test
    @Order(1)
    void testCreateClient() throws Exception {
        clientRepository.deleteAll();

        ClientRequestDto requestDto = new ClientRequestDto(
                "Alice",
                "Martin",
                "alice.martin@example.com",
                "+33612345678",
                "Acme Corp",
                "123 Boulevard Saint-Germain, Paris",
                "Urgent corporate IP case",
                ClientStatus.ACTIVE
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/clients")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.email").value("alice.martin@example.com"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn();

        ClientResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), ClientResponseDto.class);
        clientId = response.id();
    }

    @Test
    @Order(2)
    void testGetClients() throws Exception {
        mockMvc.perform(get("/api/lawyer/clients")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .param("query", "Alice")
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].firstName").value("Alice"));
    }

    @Test
    @Order(3)
    void testGetClientById() throws Exception {
        mockMvc.perform(get("/api/lawyer/clients/" + clientId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(clientId))
                .andExpect(jsonPath("$.email").value("alice.martin@example.com"));
    }

    @Test
    @Order(4)
    void testArchiveClient() throws Exception {
        mockMvc.perform(patch("/api/lawyer/clients/" + clientId + "/archive")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }
}

