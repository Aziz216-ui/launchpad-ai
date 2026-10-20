package com.launchpad.lawyer.repository;

import com.launchpad.lawyer.entity.DocumentReview;
import com.launchpad.lawyer.entity.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentReviewRepository extends JpaRepository<DocumentReview, Long> {

    List<DocumentReview> findByLawyerIdOrderByCreatedAtDesc(String lawyerId);

    Optional<DocumentReview> findByLawyerIdAndId(String lawyerId, Long id);

    List<DocumentReview> findByLawyerIdAndClientIdOrderByCreatedAtDesc(String lawyerId, Long clientId);

    List<DocumentReview> findByLawyerIdAndStatusOrderByCreatedAtDesc(String lawyerId, ReviewStatus status);
}
