package com.launchpad.lawyer.message;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.message.dto.MessageRequestDto;
import com.launchpad.lawyer.message.dto.MessageResponseDto;
import com.launchpad.lawyer.message.entity.SenderType;
import com.launchpad.lawyer.message.repository.MessageRepository;
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
class MessageServiceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MessageRepository messageRepository;

    private static Long messageId;

    @Test
    @Order(1)
    void testSendMessage() throws Exception {
        messageRepository.deleteAll();

        MessageRequestDto requestDto = new MessageRequestDto(
                1L,
                SenderType.LAWYER,
                "Case Update: Review of Contract",
                "Hello, we have examined the merger terms and prepared the review summary."
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/messages")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.subject").value("Case Update: Review of Contract"))
                .andExpect(jsonPath("$.senderType").value("LAWYER"))
                .andExpect(jsonPath("$.isRead").value(false))
                .andReturn();

        MessageResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), MessageResponseDto.class);
        messageId = response.id();
    }

    @Test
    @Order(2)
    void testGetMessages() throws Exception {
        mockMvc.perform(get("/api/lawyer/messages")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .param("clientId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].subject").value("Case Update: Review of Contract"));
    }

    @Test
    @Order(3)
    void testGetMessageById() throws Exception {
        mockMvc.perform(get("/api/lawyer/messages/detail/" + messageId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(messageId))
                .andExpect(jsonPath("$.subject").value("Case Update: Review of Contract"));
    }

    @Test
    @Order(4)
    void testCountUnread() throws Exception {
        mockMvc.perform(get("/api/lawyer/messages/unread-count")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    @Order(5)
    void testMarkAsRead() throws Exception {
        mockMvc.perform(patch("/api/lawyer/messages/" + messageId + "/read")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isRead").value(true));

        mockMvc.perform(get("/api/lawyer/messages/unread-count")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    @Order(6)
    void testDeleteMessage() throws Exception {
        mockMvc.perform(delete("/api/lawyer/messages/" + messageId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/lawyer/messages/detail/" + messageId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNotFound());
    }
}

