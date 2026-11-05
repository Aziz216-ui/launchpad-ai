package com.launchpad.lawyer.inforequest.repository;

import com.launchpad.lawyer.inforequest.entity.InformationRequest;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InformationRequestRepository extends JpaRepository<InformationRequest, Long> {

    List<InformationRequest> findByLawyerIdOrderByCreatedAtDesc(String lawyerId);

    Optional<InformationRequest> findByLawyerIdAndId(String lawyerId, Long id);

    List<InformationRequest> findByLawyerIdAndClientIdOrderByCreatedAtDesc(String lawyerId, Long clientId);

    List<InformationRequest> findByLawyerIdAndStatusOrderByCreatedAtDesc(String lawyerId, RequestStatus status);
}

