package com.launchpad.lawyer.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lawyer_review_history")
public class ReviewHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_id", nullable = false)
    private DocumentReview documentReview;

    @Enumerated(EnumType.STRING)
    @Column(name = "old_status")
    private ReviewStatus oldStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false)
    private ReviewStatus newStatus;

    @Column(name = "changed_by", nullable = false)
    private String changedBy;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    public ReviewHistory() {
    }

    public ReviewHistory(DocumentReview documentReview, ReviewStatus oldStatus, ReviewStatus newStatus, String changedBy, String reason) {
        this.documentReview = documentReview;
        this.oldStatus = oldStatus;
        this.newStatus = newStatus;
        this.changedBy = changedBy;
        this.reason = reason;
        this.timestamp = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        if (this.timestamp == null) {
            this.timestamp = LocalDateTime.now();
        }
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public DocumentReview getDocumentReview() {
        return documentReview;
    }

    public void setDocumentReview(DocumentReview documentReview) {
        this.documentReview = documentReview;
    }

    public ReviewStatus getOldStatus() {
        return oldStatus;
    }

    public void setOldStatus(ReviewStatus oldStatus) {
        this.oldStatus = oldStatus;
    }

    public ReviewStatus getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(ReviewStatus newStatus) {
        this.newStatus = newStatus;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(String changedBy) {
        this.changedBy = changedBy;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
