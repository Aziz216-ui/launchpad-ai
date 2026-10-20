package com.launchpad.lawyer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.dto.*;
import com.launchpad.lawyer.entity.ClientStatus;
import com.launchpad.lawyer.entity.RequestStatus;
import com.launchpad.lawyer.entity.ReviewStatus;
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
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LawyerSpaceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private com.launchpad.lawyer.repository.AppointmentRepository appointmentRepository;

    @Autowired
    private com.launchpad.lawyer.repository.MessageRepository messageRepository;

    @Autowired
    private com.launchpad.lawyer.repository.InformationRequestRepository informationRequestRepository;

    @Autowired
    private com.launchpad.lawyer.repository.DocumentReviewRepository documentReviewRepository;

    @Autowired
    private com.launchpad.lawyer.repository.ClientRepository clientRepository;

    private static Long clientId;
    private static Long appointmentId;
    private static Long reviewId;

    @Test
    @Order(1)
    void testCreateClient() throws Exception {
        documentReviewRepository.deleteAll();
        informationRequestRepository.deleteAll();
        messageRepository.deleteAll();
        appointmentRepository.deleteAll();
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
    void testSearchAndFilterClients() throws Exception {
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
    void testScheduleAppointmentAndDetectOverlap() throws Exception {
        LocalDateTime start = LocalDateTime.now().plusDays(2).withHour(10).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);

        AppointmentRequestDto appDto = new AppointmentRequestDto(
                clientId,
                "Consultation initiale",
                "Analyse des brevets et propriété intellectuelle",
                start,
                end,
                "Cabinet Paris",
                null
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/appointments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(appDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.title").value("Consultation initiale"))
                .andReturn();

        AppointmentResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), AppointmentResponseDto.class);
        appointmentId = response.id();

        // Test Overlapping Appointment: Same or overlapping slot should return 409 Conflict
        AppointmentRequestDto overlapDto = new AppointmentRequestDto(
                clientId,
                "Rendez-vous concurrent",
                "Tentative de double réservation",
                start.plusMinutes(30),
                end.plusMinutes(30),
                "En ligne",
                null
        );

        mockMvc.perform(post("/api/lawyer/appointments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overlapDto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Appointment Overlap Conflict"));

        // Verify retrieval using appointmentId
        mockMvc.perform(get("/api/lawyer/appointments/" + appointmentId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(appointmentId))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    @Order(4)
    void testSendMessageAndRetrieve() throws Exception {
        MessageRequestDto msgDto = new MessageRequestDto(
                clientId,
                null,
                "Pièces justificatives",
                "Veuillez nous transmettre l'annexe financière signée."
        );

        mockMvc.perform(post("/api/lawyer/communication/messages")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(msgDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.subject").value("Pièces justificatives"));

        mockMvc.perform(get("/api/lawyer/communication/messages/" + clientId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))));
    }

    @Test
    @Order(5)
    void testInformationRequestLifecycle() throws Exception {
        InformationRequestDto reqDto = new InformationRequestDto(
                clientId,
                "Extrait Kbis et Statuts",
                "Documents requis pour la constitution du dossier juridique",
                "1. Extrait Kbis récent (- 3 mois)\n2. Statuts à jour certifiés",
                LocalDate.now().plusWeeks(1)
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/communication/requests")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();

        InformationRequestResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), InformationRequestResponseDto.class);

        // Update status to SUBMITTED
        mockMvc.perform(patch("/api/lawyer/communication/requests/" + response.id() + "/status")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRequestStatusDto(RequestStatus.SUBMITTED))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
    }

    @Test
    @Order(6)
    void testDocumentReviewWorkflow() throws Exception {
        DocumentReviewRequestDto reviewDto = new DocumentReviewRequestDto(
                clientId,
                "Pacte d'actionnaires - Série A",
                "SHAREHOLDERS_AGREEMENT",
                "https://mock-storage.launchpad.ai/documents/pacte-actionnaires-v1.pdf"
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/reviews")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reviewDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.history", hasSize(1)))
                .andReturn();

        DocumentReviewResponseDto reviewResponse = objectMapper.readValue(result.getResponse().getContentAsString(), DocumentReviewResponseDto.class);
        reviewId = reviewResponse.id();

        // Add Comment with correction request
        AddCommentDto commentDto = new AddCommentDto(
                "Maître Dupont",
                4,
                "La clause de non-concurrence doit être limitée à 24 mois au lieu de 36 mois.",
                true
        );

        mockMvc.perform(post("/api/lawyer/reviews/" + reviewId + "/comments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(commentDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEEDS_CORRECTION"))
                .andExpect(jsonPath("$.comments", hasSize(1)))
                .andExpect(jsonPath("$.history", hasSize(2)));

        // Approve document after correction
        ReviewDecisionDto decisionDto = new ReviewDecisionDto(
                ReviewStatus.APPROVED,
                "Clause corrigée et validée.",
                "Maître Dupont"
        );

        mockMvc.perform(patch("/api/lawyer/reviews/" + reviewId + "/decision")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decisionDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.history", hasSize(3)));
    }
}
