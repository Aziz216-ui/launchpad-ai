package com.launchpad.lawyer.docreview.repository;

import com.launchpad.lawyer.docreview.entity.DocumentReview;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;
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

