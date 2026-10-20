package com.launchpad.lawyer.service;

import com.launchpad.lawyer.dto.*;
import com.launchpad.lawyer.entity.*;
import com.launchpad.lawyer.exception.ResourceNotFoundException;
import com.launchpad.lawyer.repository.DocumentReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class DocumentReviewService {

    private final DocumentReviewRepository documentReviewRepository;
    private final ClientService clientService;

    public DocumentReviewService(DocumentReviewRepository documentReviewRepository, ClientService clientService) {
        this.documentReviewRepository = documentReviewRepository;
        this.clientService = clientService;
    }

    public DocumentReviewResponseDto createDocumentReview(String lawyerId, DocumentReviewRequestDto dto) {
        Client client = clientService.getClientEntity(lawyerId, dto.clientId());

        DocumentReview review = new DocumentReview();
        review.setLawyerId(lawyerId);
        review.setClient(client);
        review.setDocumentTitle(dto.documentTitle());
        review.setDocumentType(dto.documentType());
        review.setDocumentUrl(dto.documentUrl());
        review.setStatus(ReviewStatus.PENDING);

        // Add initial history entry
        review.addHistory(new ReviewHistory(
                review,
                null,
                ReviewStatus.PENDING,
                lawyerId,
                "Document review record created"
        ));

        DocumentReview saved = documentReviewRepository.save(review);
        return DocumentReviewResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<DocumentReviewResponseDto> getReviews(String lawyerId, Long clientId, ReviewStatus status) {
        List<DocumentReview> list;

        if (clientId != null) {
            list = documentReviewRepository.findByLawyerIdAndClientIdOrderByCreatedAtDesc(lawyerId, clientId);
        } else if (status != null) {
            list = documentReviewRepository.findByLawyerIdAndStatusOrderByCreatedAtDesc(lawyerId, status);
        } else {
            list = documentReviewRepository.findByLawyerIdOrderByCreatedAtDesc(lawyerId);
        }

        return list.stream().map(DocumentReviewResponseDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public DocumentReviewResponseDto getReviewById(String lawyerId, Long reviewId) {
        DocumentReview review = documentReviewRepository.findByLawyerIdAndId(lawyerId, reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Document review not found with id: " + reviewId));
        return DocumentReviewResponseDto.fromEntity(review);
    }

    public DocumentReviewResponseDto addComment(String lawyerId, Long reviewId, AddCommentDto dto) {
        DocumentReview review = documentReviewRepository.findByLawyerIdAndId(lawyerId, reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Document review not found with id: " + reviewId));

        ReviewComment comment = new ReviewComment();
        comment.setAuthor(dto.author());
        comment.setPageNumber(dto.pageNumber());
        comment.setCommentText(dto.commentText());
        comment.setCorrectionRequested(dto.correctionRequested());
        review.addComment(comment);

        if (dto.correctionRequested() && review.getStatus() != ReviewStatus.NEEDS_CORRECTION) {
            ReviewStatus oldStatus = review.getStatus();
            review.setStatus(ReviewStatus.NEEDS_CORRECTION);
            review.addHistory(new ReviewHistory(
                    review,
                    oldStatus,
                    ReviewStatus.NEEDS_CORRECTION,
                    dto.author(),
                    "Correction requested in comment: " + dto.commentText()
            ));
        }

        DocumentReview saved = documentReviewRepository.save(review);
        return DocumentReviewResponseDto.fromEntity(saved);
    }

    public DocumentReviewResponseDto processDecision(String lawyerId, Long reviewId, ReviewDecisionDto dto) {
        DocumentReview review = documentReviewRepository.findByLawyerIdAndId(lawyerId, reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Document review not found with id: " + reviewId));

        ReviewStatus oldStatus = review.getStatus();
        review.setStatus(dto.status());

        String reviewer = dto.reviewerName() != null ? dto.reviewerName() : lawyerId;
        review.addHistory(new ReviewHistory(
                review,
                oldStatus,
                dto.status(),
                reviewer,
                dto.reason() != null ? dto.reason() : "Status updated to " + dto.status()
        ));

        DocumentReview saved = documentReviewRepository.save(review);
        return DocumentReviewResponseDto.fromEntity(saved);
    }
}
