package com.launchpad.lawyer.appointment.service;

import com.launchpad.lawyer.appointment.client.ClientServiceClient;
import com.launchpad.lawyer.appointment.dto.AppointmentRequestDto;
import com.launchpad.lawyer.appointment.dto.AppointmentRescheduleDto;
import com.launchpad.lawyer.appointment.dto.AppointmentResponseDto;
import com.launchpad.lawyer.appointment.entity.Appointment;
import com.launchpad.lawyer.appointment.entity.AppointmentStatus;
import com.launchpad.lawyer.appointment.exception.AppointmentOverlapException;
import com.launchpad.lawyer.appointment.exception.ResourceNotFoundException;
import com.launchpad.lawyer.appointment.messaging.AppointmentEventPublisher;
import com.launchpad.lawyer.appointment.repository.AppointmentRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class AppointmentServiceImpl implements AppointmentService {

    private static final Logger log = LoggerFactory.getLogger(AppointmentServiceImpl.class);

    private final AppointmentRepository appointmentRepository;
    private final AppointmentEventPublisher eventPublisher;
    private final ClientServiceClient clientServiceClient;

    public AppointmentServiceImpl(AppointmentRepository appointmentRepository,
                                  AppointmentEventPublisher eventPublisher,
                                  @Autowired(required = false) ClientServiceClient clientServiceClient) {
        this.appointmentRepository = appointmentRepository;
        this.eventPublisher = eventPublisher;
        this.clientServiceClient = clientServiceClient;
    }

    @Override
    public AppointmentResponseDto scheduleAppointment(String lawyerId, AppointmentRequestDto dto) {
        if (!dto.endTime().isAfter(dto.startTime())) {
            throw new IllegalArgumentException("Appointment end time must be after start time");
        }

        // Overlap Detection
        checkOverlappingAppointments(lawyerId, dto.startTime(), dto.endTime(), null);

        // Fetch client details via OpenFeign client if available
        String clientName = "Client #" + dto.clientId();
        String clientEmail = null;

        if (clientServiceClient != null) {
            try {
                ClientServiceClient.ClientDto client = clientServiceClient.getClientById(lawyerId, dto.clientId());
                if (client != null) {
                    clientName = client.fullName() != null ? client.fullName()
                            : ((client.firstName() != null ? client.firstName() : "") + " " + (client.lastName() != null ? client.lastName() : "")).trim();
                    clientEmail = client.email();
                }
            } catch (FeignException.NotFound e) {
                throw new ResourceNotFoundException("Client not found with id: " + dto.clientId());
            } catch (Exception e) {
                log.warn("Client service call failed or unavailable for clientId {}: {}", dto.clientId(), e.getMessage());
            }
        }

        Appointment appointment = new Appointment();
        appointment.setLawyerId(lawyerId);
        appointment.setClientId(dto.clientId());
        appointment.setClientName(clientName);
        appointment.setClientEmail(clientEmail);
        appointment.setTitle(dto.title());
        appointment.setDescription(dto.description());
        appointment.setStartTime(dto.startTime());
        appointment.setEndTime(dto.endTime());
        appointment.setLocation(dto.location() != null ? dto.location() : "Cabinet / Visio");
        appointment.setStatus(dto.status() != null ? dto.status() : AppointmentStatus.SCHEDULED);

        Appointment saved = appointmentRepository.save(appointment);

        // RabbitMQ Async Event Notification
        publishEvent("SCHEDULED", saved);

        return AppointmentResponseDto.fromEntity(saved);
    }

    @Override
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

    @Override
    @Transactional(readOnly = true)
    public AppointmentResponseDto getAppointmentById(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));
        return AppointmentResponseDto.fromEntity(appointment);
    }

    @Override
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
        publishEvent("RESCHEDULED", updated);
        return AppointmentResponseDto.fromEntity(updated);
    }

    @Override
    public AppointmentResponseDto cancelAppointment(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));

        appointment.setStatus(AppointmentStatus.CANCELLED);
        Appointment updated = appointmentRepository.save(appointment);
        publishEvent("CANCELLED", updated);
        return AppointmentResponseDto.fromEntity(updated);
    }

    @Override
    public AppointmentResponseDto completeAppointment(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));

        appointment.setStatus(AppointmentStatus.COMPLETED);
        Appointment updated = appointmentRepository.save(appointment);
        publishEvent("COMPLETED", updated);
        return AppointmentResponseDto.fromEntity(updated);
    }

    @Override
    public void deleteAppointment(String lawyerId, Long id) {
        Appointment appointment = appointmentRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with id: " + id));
        appointmentRepository.delete(appointment);
        publishEvent("DELETED", appointment);
    }

    private void publishEvent(String eventType, Appointment appointment) {
        eventPublisher.publishAppointmentEvent(
                eventType,
                appointment.getId(),
                appointment.getLawyerId(),
                appointment.getClientId(),
                appointment.getClientName(),
                appointment.getTitle(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getLocation(),
                appointment.getStatus() != null ? appointment.getStatus().name() : "SCHEDULED"
        );
    }

    private void checkOverlappingAppointments(String lawyerId, LocalDateTime start, LocalDateTime end, Long excludeId) {
        List<Appointment> conflicts = appointmentRepository.findOverlappingAppointments(lawyerId, start, end, excludeId);
        if (!conflicts.isEmpty()) {
            Appointment conflict = conflicts.get(0);
            throw new AppointmentOverlapException(String.format(
                    "Appointment time conflict with existing appointment '%s' (from %s to %s)",
                    conflict.getTitle(), conflict.getStartTime(), conflict.getEndTime()
            ));
        }
    }
}

