package com.launchpad.lawyer.appointment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.launchpad.lawyer.appointment.dto.AppointmentRequestDto;
import com.launchpad.lawyer.appointment.dto.AppointmentRescheduleDto;
import com.launchpad.lawyer.appointment.dto.AppointmentResponseDto;
import com.launchpad.lawyer.appointment.entity.AppointmentStatus;
import com.launchpad.lawyer.appointment.repository.AppointmentRepository;
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

import java.time.LocalDateTime;

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
class AppointmentServiceApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppointmentRepository appointmentRepository;

    private static Long appointmentId;

    @Test
    @Order(1)
    void testScheduleAppointment() throws Exception {
        appointmentRepository.deleteAll();

        LocalDateTime start = LocalDateTime.now().plusDays(2).withHour(10).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);

        AppointmentRequestDto requestDto = new AppointmentRequestDto(
                1L,
                "Consultation Case #442",
                "Review merger and agreement terms",
                start,
                end,
                "Cabinet Paris 8",
                AppointmentStatus.SCHEDULED
        );

        MvcResult result = mockMvc.perform(post("/api/lawyer/appointments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.title").value("Consultation Case #442"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.clientId").value(1L))
                .andReturn();

        AppointmentResponseDto response = objectMapper.readValue(result.getResponse().getContentAsString(), AppointmentResponseDto.class);
        appointmentId = response.id();
    }

    @Test
    @Order(2)
    void testScheduleOverlappingAppointment_FailsWithConflict() throws Exception {
        LocalDateTime start = LocalDateTime.now().plusDays(2).withHour(10).withMinute(30).withSecond(0).withNano(0);
        LocalDateTime end = start.plusHours(1);

        AppointmentRequestDto overlapDto = new AppointmentRequestDto(
                2L,
                "Conflicting Consultation",
                "This overlaps with the previous one",
                start,
                end,
                "Cabinet Paris 8",
                AppointmentStatus.SCHEDULED
        );

        mockMvc.perform(post("/api/lawyer/appointments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overlapDto)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Appointment Overlap Conflict"));
    }

    @Test
    @Order(3)
    void testGetAppointments() throws Exception {
        mockMvc.perform(get("/api/lawyer/appointments")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .param("status", "SCHEDULED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].title").value("Consultation Case #442"));
    }

    @Test
    @Order(4)
    void testGetAppointmentById() throws Exception {
        mockMvc.perform(get("/api/lawyer/appointments/" + appointmentId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(appointmentId))
                .andExpect(jsonPath("$.title").value("Consultation Case #442"));
    }

    @Test
    @Order(5)
    void testRescheduleAppointment() throws Exception {
        LocalDateTime newStart = LocalDateTime.now().plusDays(3).withHour(14).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime newEnd = newStart.plusHours(1);

        AppointmentRescheduleDto rescheduleDto = new AppointmentRescheduleDto(
                newStart,
                newEnd,
                "Visio Conference"
        );

        mockMvc.perform(patch("/api/lawyer/appointments/" + appointmentId + "/reschedule")
                        .header("X-Lawyer-Id", "lawyer-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rescheduleDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESCHEDULED"))
                .andExpect(jsonPath("$.location").value("Visio Conference"));
    }

    @Test
    @Order(6)
    void testCompleteAppointment() throws Exception {
        mockMvc.perform(patch("/api/lawyer/appointments/" + appointmentId + "/complete")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    @Order(7)
    void testCancelAppointment() throws Exception {
        mockMvc.perform(patch("/api/lawyer/appointments/" + appointmentId + "/cancel")
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    @Order(8)
    void testDeleteAppointment() throws Exception {
        mockMvc.perform(delete("/api/lawyer/appointments/" + appointmentId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/lawyer/appointments/" + appointmentId)
                        .header("X-Lawyer-Id", "lawyer-1"))
                .andExpect(status().isNotFound());
    }
}

