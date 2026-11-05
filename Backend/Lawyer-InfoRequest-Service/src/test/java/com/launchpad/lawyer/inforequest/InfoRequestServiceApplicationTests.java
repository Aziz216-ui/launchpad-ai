package com.launchpad.lawyer.inforequest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.inforequest.dto.InformationRequestDto;
import com.launchpad.lawyer.inforequest.dto.InformationRequestResponseDto;
import com.launchpad.lawyer.inforequest.dto.UpdateRequestStatusDto;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import com.launchpad.lawyer.inforequest.repository.InformationRequestRepository;
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

import java.time.LocalDate;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.rabbitmq.listener.simple.auto-startup=false",
        "client-service.url=http://localhost:8082"
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class InfoRequestServiceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InformationRequestRepository informationRequestRepository;

    private static Long requestId;

    @Test
    @Order(1)
    void testCreateInformationRequest() throws Exception {
        informationRequestRepository.deleteAll();

        InformationRequestDto requestDto = new InformationRequestDto(
                1L,
                "Request for Audited Balance Sheet 2025",
                "Please upload signed copies of corporate tax filings and balance sheets.",
                "Tax return 2025, Balance sheet 2025, Auditor notes",
                LocalDate.now().plusMonths(1)
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/requests")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.title").value("Request for Audited Balance Sheet 2025"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.clientId").value(1L))
                .andReturn();

        InformationRequestResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), InformationRequestResponseDto.class);
        requestId = response.id();
    }

    @Test
    @Order(2)
    void testGetInformationRequests() throws Exception {
        mockMvc.perform(get("/api/lawyer/requests")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].title").value("Request for Audited Balance Sheet 2025"));
    }

    @Test
    @Order(3)
    void testGetInformationRequestById() throws Exception {
        mockMvc.perform(get("/api/lawyer/requests/" + requestId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(requestId))
                .andExpect(jsonPath("$.title").value("Request for Audited Balance Sheet 2025"));
    }

    @Test
    @Order(4)
    void testUpdateRequestStatus() throws Exception {
        UpdateRequestStatusDto statusDto = new UpdateRequestStatusDto(RequestStatus.SUBMITTED);

        mockMvc.perform(patch("/api/lawyer/requests/" + requestId + "/status")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(statusDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
    }

    @Test
    @Order(5)
    void testUpdateRequest() throws Exception {
        InformationRequestDto updateDto = new InformationRequestDto(
                1L,
                "Request for Audited Balance Sheet 2025 (Updated)",
                "Updated details: please include Q4 appendix.",
                "Tax return 2025, Balance sheet 2025, Q4 appendix",
                LocalDate.now().plusMonths(2)
        );

        mockMvc.perform(put("/api/lawyer/requests/" + requestId)
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Request for Audited Balance Sheet 2025 (Updated)"));
    }

    @Test
    @Order(6)
    void testDeleteRequest() throws Exception {
        mockMvc.perform(delete("/api/lawyer/requests/" + requestId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/lawyer/requests/" + requestId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNotFound());
    }
}

