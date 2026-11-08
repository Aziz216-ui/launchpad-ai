package com.launchpad.lawyer.docreview.service;

import com.launchpad.lawyer.docreview.dto.AddCommentDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewRequestDto;
import com.launchpad.lawyer.docreview.dto.DocumentReviewResponseDto;
import com.launchpad.lawyer.docreview.dto.ReviewDecisionDto;
import com.launchpad.lawyer.docreview.entity.ReviewStatus;

import java.util.List;

public interface DocumentReviewService {

    DocumentReviewResponseDto createDocumentReview(String lawyerId, DocumentReviewRequestDto dto);

    List<DocumentReviewResponseDto> getReviews(String lawyerId, Long clientId, ReviewStatus status);

    DocumentReviewResponseDto getReviewById(String lawyerId, Long reviewId);

    DocumentReviewResponseDto addComment(String lawyerId, Long reviewId, AddCommentDto dto);

    DocumentReviewResponseDto processDecision(String lawyerId, Long reviewId, ReviewDecisionDto dto);

    void deleteReview(String lawyerId, Long reviewId);
}

