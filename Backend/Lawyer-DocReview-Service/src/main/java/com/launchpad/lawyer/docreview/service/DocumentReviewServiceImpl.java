package com.launchpad.lawyer.docreview.service;

import com.launchpad.lawyer.docreview.client.ClientServiceClient;
import com.launchpad.lawyer.docreview.dto.AddCommentDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewRequestDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewResponseDto;
import com.launchpad.lawyer.docreview.dto.ReviewDecisionDto;
import com.launchpad.lawyer.docreview.entity.DocumentReview;
import com.launchpad.lawyer.docreview.entity.ReviewComment;
import com.launchpad.lawyer.docreview.entity.ReviewHistory;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;
import com.launchpad.lawyer.docreview.exception.ResourceNotFoundException;
import com.launchpad.lawyer.docreview.messaging.DocReviewEventPublisher;
import com.launchpad.lawyer.docreview.repository.DocumentReviewRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class DocumentReviewServiceImpl implements DocumentReviewService {

    private static final Logger log = LoggerFactory.getLogger(DocumentReviewServiceImpl.class);

    private final DocumentReviewRepository documentReviewRepository;
    private final DocReviewEventPublisher eventPublisher;
    private final ClientServiceClient clientServiceClient;

    public DocumentReviewServiceImpl(DocumentReviewRepository documentReviewRepository,
                                     DocReviewEventPublisher eventPublisher,
                                     @Autowired(required = false) ClientServiceClient clientServiceClient) {
        this.documentReviewRepository = documentReviewRepository;
        this.eventPublisher = eventPublisher;
        this.clientServiceClient = clientServiceClient;
    }

    @Override
    public DocumentReviewResponseDto createDocumentReview(String lawyerId, DocumentReviewRequestDto dto) {
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

        DocumentReview review = new DocumentReview();
        review.setLawyerId(lawyerId);
        review.setClientId(dto.clientId());
        review.setClientName(clientName);
        review.setClientEmail(clientEmail);
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

        // RabbitMQ: Asynchronous Event Notification
        publishEvent("CREATED", saved, "New document uploaded for review: " + saved.getDocumentTitle());

        return DocumentReviewResponseDto.fromEntity(saved);
    }

    @Override
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

    @Override
    @Transactional(readOnly = true)
    public DocumentReviewResponseDto getReviewById(String lawyerId, Long reviewId) {
        DocumentReview review = documentReviewRepository.findByLawyerIdAndId(lawyerId, reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Document review not found with id: " + reviewId));
        return DocumentReviewResponseDto.fromEntity(review);
    }

    @Override
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
        publishEvent("COMMENT_ADDED", saved, "Comment added by " + dto.author());
        return DocumentReviewResponseDto.fromEntity(saved);
    }

    @Override
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
        publishEvent("DECISION_TAKEN", saved, "Status updated to " + dto.status());
        return DocumentReviewResponseDto.fromEntity(saved);
    }

    @Override
    public void deleteReview(String lawyerId, Long reviewId) {
        DocumentReview review = documentReviewRepository.findByLawyerIdAndId(lawyerId, reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Document review not found with id: " + reviewId));
        documentReviewRepository.delete(review);
        publishEvent("DELETED", review, "Document review deleted");
    }

    private void publishEvent(String eventType, DocumentReview review, String summary) {
        eventPublisher.publishEvent(
                eventType,
                review.getId(),
                review.getLawyerId(),
                review.getClientId(),
                review.getClientName(),
                review.getDocumentTitle(),
                review.getStatus().name(),
                summary
        );
    }
}

