package com.launchpad.lawyer.appointment.service;

import com.launchpad.lawyer.appointment.dto.AppointmentRequestDto;
import com.launchpad.lawyer.appointment.dto.AppointmentRescheduleDto;
import com.launchpad.lawyer.appointment.dto.AppointmentResponseDto;
import com.launchpad.lawyer.appointment.entity.AppointmentStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface AppointmentService {

    AppointmentResponseDto scheduleAppointment(String lawyerId, AppointmentRequestDto dto);

    List<AppointmentResponseDto> getAppointments(String lawyerId, Long clientId, LocalDateTime startDate, LocalDateTime endDate, AppointmentStatus status);

    AppointmentResponseDto getAppointmentById(String lawyerId, Long id);

    AppointmentResponseDto rescheduleAppointment(String lawyerId, Long id, AppointmentRescheduleDto dto);

    AppointmentResponseDto completeAppointment(String lawyerId, Long id);

    AppointmentResponseDto cancelAppointment(String lawyerId, Long id);

    void deleteAppointment(String lawyerId, Long id);
}

