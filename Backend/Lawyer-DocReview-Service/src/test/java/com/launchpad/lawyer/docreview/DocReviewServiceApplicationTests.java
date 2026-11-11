package com.launchpad.lawyer.docreview;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.docreview.dto.AddCommentDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewRequestDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewResponseDto;
import com.launchpad.lawyer.docreview.dto.ReviewDecisionDto;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;
import com.launchpad.lawyer.docreview.repository.DocumentReviewRepository;
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
        "spring.rabbitmq.listener.simple.auto-startup=false",
})
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DocReviewServiceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DocumentReviewRepository documentReviewRepository;

    private static Long reviewId;

    @Test
    @Order(1)
    void testCreateDocumentReview() throws Exception {
        documentReviewRepository.deleteAll();

        DocumentReviewRequestDto requestDto = new DocumentReviewRequestDto(
                1L,
                "Commercial Lease Agreement v2.1",
                "Contract / Lease",
                "https://s3.cloud.provider/docs/lease-v2.pdf"
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/reviews")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.documentTitle").value("Commercial Lease Agreement v2.1"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.clientId").value(1L))
                .andReturn();

        DocumentReviewResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), DocumentReviewResponseDto.class);
        reviewId = response.id();
    }

    @Test
    @Order(2)
    void testAddCommentWithCorrectionRequested() throws Exception {
        AddCommentDto commentDto = new AddCommentDto(
                "Maître Dupont",
                4,
                "Clause 14.2 lacks indexation ceiling - please revise.",
                true
        );

        mockMvc.perform(post("/api/lawyer/reviews/" + reviewId + "/comments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEEDS_CORRECTION"))
                .andExpect(jsonPath("$.comments", hasSize(1)))
                .andExpect(jsonPath("$.comments[0].correctionRequested").value(true));
    }

    @Test
    @Order(3)
    void testProcessDecision() throws Exception {
        ReviewDecisionDto decisionDto = new ReviewDecisionDto(
                ReviewStatus.APPROVED,
                "Revised version conforms to French Commercial Code requirements.",
                "Maître Dupont"
        );

        mockMvc.perform(patch("/api/lawyer/reviews/" + reviewId + "/decision")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decisionDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.history", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @Order(4)
    void testGetReviewById() throws Exception {
        mockMvc.perform(get("/api/lawyer/reviews/" + reviewId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(reviewId))
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.comments", hasSize(1)))
                .andExpect(jsonPath("$.history", hasSize(greaterThanOrEqualTo(2))));
    }

    @Test
    @Order(5)
    void testGetReviews() throws Exception {
        mockMvc.perform(get("/api/lawyer/reviews")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .param("status", "APPROVED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].documentTitle").value("Commercial Lease Agreement v2.1"));
    }

    @Test
    @Order(6)
    void testDeleteReview() throws Exception {
        mockMvc.perform(delete("/api/lawyer/reviews/" + reviewId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/lawyer/reviews/" + reviewId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNotFound());
    }
}

