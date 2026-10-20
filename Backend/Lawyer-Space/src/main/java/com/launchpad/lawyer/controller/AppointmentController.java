package com.launchpad.lawyer.controller;

import com.launchpad.lawyer.dto.AppointmentRequestDto;
import com.launchpad.lawyer.dto.AppointmentRescheduleDto;
import com.launchpad.lawyer.dto.AppointmentResponseDto;
import com.launchpad.lawyer.entity.AppointmentStatus;
import com.launchpad.lawyer.service.AppointmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/lawyer/appointments")
@Tag(name = "2. Appointment Management", description = "Endpoints for scheduling, rescheduling, cancelling, and tracking appointments with overlap conflict detection.")
@CrossOrigin(origins = "*")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping
    @Operation(summary = "Schedule an appointment", description = "Schedules a new appointment with a client. Detects overlapping appointment conflicts.")
    public ResponseEntity<AppointmentResponseDto> scheduleAppointment(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @Valid @RequestBody AppointmentRequestDto requestDto) {
        AppointmentResponseDto response = appointmentService.scheduleAppointment(lawyerId, requestDto);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "View appointments", description = "Retrieves appointments filtered by client, date range, or status.")
    public ResponseEntity<List<AppointmentResponseDto>> getAppointments(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) AppointmentStatus status) {
        List<AppointmentResponseDto> list = appointmentService.getAppointments(lawyerId, clientId, startDate, endDate, status);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get appointment details", description = "Retrieves details of a specific appointment by ID.")
    public ResponseEntity<AppointmentResponseDto> getAppointmentById(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        AppointmentResponseDto appointment = appointmentService.getAppointmentById(lawyerId, id);
        return ResponseEntity.ok(appointment);
    }

    @PatchMapping("/{id}/reschedule")
    @Operation(summary = "Reschedule an appointment", description = "Updates appointment start and end times. Validates and prevents overlapping conflicts.")
    public ResponseEntity<AppointmentResponseDto> rescheduleAppointment(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id,
            @Valid @RequestBody AppointmentRescheduleDto rescheduleDto) {
        AppointmentResponseDto updated = appointmentService.rescheduleAppointment(lawyerId, id, rescheduleDto);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/cancel")
    @Operation(summary = "Cancel an appointment", description = "Cancels a scheduled appointment.")
    public ResponseEntity<AppointmentResponseDto> cancelAppointment(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        AppointmentResponseDto cancelled = appointmentService.cancelAppointment(lawyerId, id);
        return ResponseEntity.ok(cancelled);
    }

    @PatchMapping("/{id}/complete")
    @Operation(summary = "Mark appointment as completed", description = "Marks a scheduled appointment as COMPLETED.")
    public ResponseEntity<AppointmentResponseDto> completeAppointment(
            @Parameter(description = "Authenticated Lawyer ID")
            @RequestHeader(value = "X-Lawyer-Id", defaultValue = "lawyer-1") String lawyerId,
            @PathVariable Long id) {
        AppointmentResponseDto completed = appointmentService.completeAppointment(lawyerId, id);
        return ResponseEntity.ok(completed);
    }
}
