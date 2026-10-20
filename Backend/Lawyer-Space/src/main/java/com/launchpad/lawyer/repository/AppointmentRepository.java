package com.launchpad.lawyer.repository;

import com.launchpad.lawyer.entity.Appointment;
import com.launchpad.lawyer.entity.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    List<Appointment> findByLawyerIdOrderByStartTimeAsc(String lawyerId);

    Optional<Appointment> findByLawyerIdAndId(String lawyerId, Long id);

    List<Appointment> findByLawyerIdAndClientIdOrderByStartTimeAsc(String lawyerId, Long clientId);

    List<Appointment> findByLawyerIdAndStatusOrderByStartTimeAsc(String lawyerId, AppointmentStatus status);

    @Query("SELECT a FROM Appointment a WHERE a.lawyerId = :lawyerId " +
           "AND a.startTime >= :startDate AND a.endTime <= :endDate " +
           "ORDER BY a.startTime ASC")
    List<Appointment> findByLawyerIdAndDateRange(
            @Param("lawyerId") String lawyerId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );

    @Query("SELECT a FROM Appointment a WHERE a.lawyerId = :lawyerId " +
           "AND a.status != 'CANCELLED' " +
           "AND (:excludeId IS NULL OR a.id != :excludeId) " +
           "AND (a.startTime < :newEndTime AND a.endTime > :newStartTime)")
    List<Appointment> findOverlappingAppointments(
            @Param("lawyerId") String lawyerId,
            @Param("newStartTime") LocalDateTime newStartTime,
            @Param("newEndTime") LocalDateTime newEndTime,
            @Param("excludeId") Long excludeId
    );
}
