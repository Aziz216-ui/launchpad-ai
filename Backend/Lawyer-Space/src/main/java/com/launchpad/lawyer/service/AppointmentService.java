package com.launchpad.lawyer.service;

import com.launchpad.lawyer.dto.AppointmentRequestDto;
import com.launchpad.lawyer.dto.AppointmentRescheduleDto;
import com.launchpad.lawyer.dto.AppointmentResponseDto;
import com.launchpad.lawyer.entity.Appointment;
import com.launchpad.lawyer.entity.AppointmentStatus;
import com.launchpad.lawyer.entity.Client;
import com.launchpad.lawyer.exception.AppointmentOverlapException;
import com.launchpad.lawyer.exception.ResourceNotFoundException;
import com.launchpad.lawyer.repository.AppointmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final ClientService clientService;

    public AppointmentService(AppointmentRepository appointmentRepository, ClientService clientService) {
        this.appointmentRepository = appointmentRepository;
        this.clientService = clientService;
    }

    public AppointmentResponseDto scheduleAppointment(String lawyerId, AppointmentRequestDto dto) {
        if (!dto.endTime().isAfter(dto.startTime())) {
            throw new IllegalArgumentException("Appointment end time must be after start time");
        }

        // Overlap Detection
        checkOverlappingAppointments(lawyerId, dto.startTime(), dto.endTime(), null);

        Client client = clientService.getClientEntity(lawyerId, dto.clientId());

        Appointment appointment = new Appointment();
        appointment.setLawyerId(lawyerId);
        appointment.setClient(client);
        appointment.setTitle(dto.title());
        appointment.setDescription(dto.description());
        appointment.setStartTime(dto.startTime());
        appointment.setEndTime(dto.endTime());
        appointment.setLocation(dto.location() != null ? dto.location() : "Cabinet / Visio");
        appointment.setStatus(dto.status() != null ? dto.status() : AppointmentStatus.SCHEDULED);

        Appointment saved = appointmentRepository.save(appointment);
        return AppointmentResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponseDto> getAppointments(String lawyerId, Long clientId, LocalDateTime startDate, LocalDateTime endDate, AppointmentStatus status) {
        List<Appointment> list;

        if (clientId != null) {
            list = appointmentRepository.findByLawyerIdAndClientIdOrderByStartTimeAsc(lawyerId, clientId);
        } else if (startDate != null && endDate != null) {
            list = appointmentRepository.findByLawyerIdAndDateRange(lawyerId, startDate, endDate);
        } else if (status != null) {
            list = appointmentRepository.findByLawyerIdAndStatusOrderByStartTimeAsc(lawyerId, status);
        } else {
            list = appointmentRepository.findByLawyerIdOrderByStartTimeAsc(lawyerId);
        }

        return list.stream().map(AppointmentResponseDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public AppointmentResponseDto getAppointmentById(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));
        return AppointmentResponseDto.fromEntity(appointment);
    }

    public AppointmentResponseDto rescheduleAppointment(String lawyerId, Long id, AppointmentRescheduleDto dto) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));

        if (!dto.newEndTime().isAfter(dto.newStartTime())) {
            throw new IllegalArgumentException("Appointment new end time must be after new start time");
        }

        // Check for conflicts excluding this appointment
        checkOverlappingAppointments(lawyerId, dto.newStartTime(), dto.newEndTime(), id);

        appointment.setStartTime(dto.newStartTime());
        appointment.setEndTime(dto.newEndTime());
        if (dto.location() != null) {
            appointment.setLocation(dto.location());
        }
        appointment.setStatus(AppointmentStatus.RESCHEDULED);

        Appointment updated = appointmentRepository.save(appointment);
        return AppointmentResponseDto.fromEntity(updated);
    }

    public AppointmentResponseDto cancelAppointment(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));

        appointment.setStatus(AppointmentStatus.CANCELLED);
        Appointment updated = appointmentRepository.save(appointment);
        return AppointmentResponseDto.fromEntity(updated);
    }

    public AppointmentResponseDto completeAppointment(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));

        appointment.setStatus(AppointmentStatus.COMPLETED);
        Appointment updated = appointmentRepository.save(appointment);
        return AppointmentResponseDto.fromEntity(updated);
    }

    private void checkOverlappingAppointments(String lawyerId, LocalDateTime start, LocalDateTime end, Long excludeId) {
        List<Appointment> conflicts = appointmentRepository.findOverlappingAppointments(lawyerId, start, end, excludeId);
        if (!conflicts.isEmpty()) {
            Appointment conflict = conflicts.get(0);
            throw new AppointmentOverlapException(
                    String.format("Overlapping appointment detected: '%s' scheduled from %s to %s",
                            conflict.getTitle(), conflict.getStartTime(), conflict.getEndTime())
            );
        }
    }
}
