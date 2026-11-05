package com.launchpad.lawyer.inforequest.service;

import com.launchpad.lawyer.inforequest.client.ClientServiceClient;
import com.launchpad.lawyer.inforequest.dto.InformationRequestDto;
import com.launchpad.lawyer.inforequest.dto.InformationRequestResponseDto;
import com.launchpad.lawyer.inforequest.entity.InformationRequest;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import com.launchpad.lawyer.inforequest.exception.ResourceNotFoundException;
import com.launchpad.lawyer.inforequest.messaging.InfoRequestEventPublisher;
import com.launchpad.lawyer.inforequest.repository.InformationRequestRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class InformationRequestServiceImpl implements InformationRequestService {

    private static final Logger log = LoggerFactory.getLogger(InformationRequestServiceImpl.class);

    private final InformationRequestRepository informationRequestRepository;
    private final InfoRequestEventPublisher eventPublisher;
    private final ClientServiceClient clientServiceClient;

    public InformationRequestServiceImpl(InformationRequestRepository informationRequestRepository,
                                         InfoRequestEventPublisher eventPublisher,
                                         @Autowired(required = false) ClientServiceClient clientServiceClient) {
        this.informationRequestRepository = informationRequestRepository;
        this.eventPublisher = eventPublisher;
        this.clientServiceClient = clientServiceClient;
    }

    @Override
    public InformationRequestResponseDto createInformationRequest(String lawyerId, InformationRequestDto dto) {
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

        InformationRequest req = new InformationRequest();
        req.setLawyerId(lawyerId);
        req.setClientId(dto.clientId());
        req.setClientName(clientName);
        req.setClientEmail(clientEmail);
        req.setTitle(dto.title());
        req.setDescription(dto.description());
        req.setRequestedItems(dto.requestedItems());
        req.setDueDate(dto.dueDate());
        req.setStatus(RequestStatus.PENDING);

        InformationRequest saved = informationRequestRepository.save(req);

        // RabbitMQ: Asynchronous Event Notification
        publishEvent("CREATED", saved);

        return InformationRequestResponseDto.fromEntity(saved);
    }

    @Override
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

    @Override
    @Transactional(readOnly = true)
    public InformationRequestResponseDto getInformationRequestById(String lawyerId, Long id) {
        InformationRequest req = informationRequestRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Information request not found with id: " + id));
        return InformationRequestResponseDto.fromEntity(req);
    }

    @Override
    public InformationRequestResponseDto updateInformationRequestStatus(String lawyerId, Long requestId, RequestStatus newStatus) {
        InformationRequest req = informationRequestRepository.findByLawyerIdAndId(lawyerId, requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Information request not found with id: " + requestId));

        req.setStatus(newStatus);
        InformationRequest updated = informationRequestRepository.save(req);
        publishEvent("STATUS_UPDATED", updated);
        return InformationRequestResponseDto.fromEntity(updated);
    }

    @Override
    public InformationRequestResponseDto updateInformationRequest(String lawyerId, Long id, InformationRequestDto dto) {
        InformationRequest req = informationRequestRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Information request not found with id: " + id));

        if (dto.title() != null) req.setTitle(dto.title());
        if (dto.description() != null) req.setDescription(dto.description());
        if (dto.requestedItems() != null) req.setRequestedItems(dto.requestedItems());
        if (dto.dueDate() != null) req.setDueDate(dto.dueDate());

        InformationRequest updated = informationRequestRepository.save(req);
        publishEvent("UPDATED", updated);
        return InformationRequestResponseDto.fromEntity(updated);
    }

    @Override
    public void deleteInformationRequest(String lawyerId, Long id) {
        InformationRequest req = informationRequestRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Information request not found with id: " + id));
        informationRequestRepository.delete(req);
        publishEvent("DELETED", req);
    }

    private void publishEvent(String eventType, InformationRequest req) {
        eventPublisher.publishEvent(
                eventType,
                req.getId(),
                req.getLawyerId(),
                req.getClientId(),
                req.getClientName(),
                req.getTitle(),
                req.getStatus().name(),
                req.getDueDate()
        );
    }
}

