package com.launchpad.lawyer.service;

import com.launchpad.lawyer.dto.*;
import com.launchpad.lawyer.entity.*;
import com.launchpad.lawyer.exception.ResourceNotFoundException;
import com.launchpad.lawyer.repository.InformationRequestRepository;
import com.launchpad.lawyer.repository.MessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CommunicationService {

    private final MessageRepository messageRepository;
    private final InformationRequestRepository informationRequestRepository;
    private final ClientService clientService;

    public CommunicationService(MessageRepository messageRepository,
                                InformationRequestRepository informationRequestRepository,
                                ClientService clientService) {
        this.messageRepository = messageRepository;
        this.informationRequestRepository = informationRequestRepository;
        this.clientService = clientService;
    }

    public MessageResponseDto sendMessage(String lawyerId, MessageRequestDto dto) {
        Client client = clientService.getClientEntity(lawyerId, dto.clientId());

        Message message = new Message();
        message.setLawyerId(lawyerId);
        message.setClient(client);
        message.setSenderType(dto.senderType() != null ? dto.senderType() : SenderType.LAWYER);
        message.setSubject(dto.subject());
        message.setContent(dto.content());
        message.setRead(false);

        Message saved = messageRepository.save(message);
        return MessageResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<MessageResponseDto> getMessagesByClient(String lawyerId, Long clientId) {
        // verify client exists and belongs to lawyer
        clientService.getClientEntity(lawyerId, clientId);

        return messageRepository.findByLawyerIdAndClientIdOrderBySentAtAsc(lawyerId, clientId)
                .stream()
                .map(MessageResponseDto::fromEntity)
                .toList();
    }

    public InformationRequestResponseDto createInformationRequest(String lawyerId, InformationRequestDto dto) {
        Client client = clientService.getClientEntity(lawyerId, dto.clientId());

        InformationRequest req = new InformationRequest();
        req.setLawyerId(lawyerId);
        req.setClient(client);
        req.setTitle(dto.title());
        req.setDescription(dto.description());
        req.setRequestedItems(dto.requestedItems());
        req.setDueDate(dto.dueDate());
        req.setStatus(RequestStatus.PENDING);

        InformationRequest saved = informationRequestRepository.save(req);
        return InformationRequestResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<InformationRequestResponseDto> getInformationRequests(String lawyerId, Long clientId, RequestStatus status) {
        List<InformationRequest> list;

        if (clientId != null) {
            list = informationRequestRepository.findByLawyerIdAndClientIdOrderByCreatedAtDesc(lawyerId, clientId);
        } else if (status != null) {
            list = informationRequestRepository.findByLawyerIdAndStatusOrderByCreatedAtDesc(lawyerId, status);
        } else {
            list = informationRequestRepository.findByLawyerIdOrderByCreatedAtDesc(lawyerId);
        }

        return list.stream().map(InformationRequestResponseDto::fromEntity).toList();
    }

    public InformationRequestResponseDto updateInformationRequestStatus(String lawyerId, Long requestId, RequestStatus newStatus) {
        InformationRequest req = informationRequestRepository.findByLawyerIdAndId(lawyerId, requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Information request not found with id: " + requestId));

        req.setStatus(newStatus);
        InformationRequest updated = informationRequestRepository.save(req);
        return InformationRequestResponseDto.fromEntity(updated);
    }
}
