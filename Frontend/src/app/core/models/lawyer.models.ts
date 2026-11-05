// Models for Lawyer & Startup Space

export interface LawyerProfile {
  id: number;
  fullName: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  avatarText: string;
  location: string;
  hourlyRate: string;
  availability: string;
  description: string;
}

export interface Client {
  id?: number;
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  notes?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id?: number;
  clientId: number;
  clientName?: string;
  senderType: 'LAWYER' | 'CLIENT' | 'SYSTEM';
  content: string;
  sentAt?: string;
  read: boolean;
}

export interface DocReview {
  id?: number;
  clientId: number;
  clientName?: string;
  documentTitle: string;
  documentType: string;
  fileUrl?: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
  decisionNotes?: string;
  submittedAt?: string;
  reviewedAt?: string;
}
