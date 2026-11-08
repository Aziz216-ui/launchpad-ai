package com.launchpad.lawyer.message.service;

import com.launchpad.lawyer.message.client.ClientServiceClient;
import com.launchpad.lawyer.message.dto.MessageRequestDto;
import com.launchpad.lawyer.message.dto.MessageResponseDto;
import com.launchpad.lawyer.message.entity.Message;
import com.launchpad.lawyer.message.entity.SenderType;
import com.launchpad.lawyer.message.exception.ResourceNotFoundException;
import com.launchpad.lawyer.message.messaging.MessageEventPublisher;
import com.launchpad.lawyer.message.repository.MessageRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class MessageServiceImpl implements MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageServiceImpl.class);

    private final MessageRepository messageRepository;
    private final MessageEventPublisher eventPublisher;
    private final ClientServiceClient clientServiceClient;

    public MessageServiceImpl(MessageRepository messageRepository,
                              MessageEventPublisher eventPublisher,
                              @Autowired(required = false) ClientServiceClient clientServiceClient) {
        this.messageRepository = messageRepository;
        this.eventPublisher = eventPublisher;
        this.clientServiceClient = clientServiceClient;
    }

    @Override
    public MessageResponseDto sendMessage(String lawyerId, MessageRequestDto dto) {
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

        Message message = new Message();
        message.setLawyerId(lawyerId);
        message.setClientId(dto.clientId());
        message.setClientName(clientName);
        message.setClientEmail(clientEmail);
        message.setSenderType(dto.senderType() != null ? dto.senderType() : SenderType.LAWYER);
        message.setSubject(dto.subject());
        message.setContent(dto.content());
        message.setRead(false);

        Message saved = messageRepository.save(message);

        // RabbitMQ: Asynchronous Event Notification
        String preview = saved.getContent().length() > 60
                ? saved.getContent().substring(0, 60) + "..."
                : saved.getContent();
        eventPublisher.publishMessageEvent(
                saved.getId(),
                saved.getLawyerId(),
                saved.getClientId(),
                saved.getClientName(),
                saved.getSubject(),
                preview,
                saved.getSentAt()
        );

        return MessageResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponseDto> getMessagesByClient(String lawyerId, Long clientId) {
        return messageRepository.findByLawyerIdAndClientIdOrderBySentAtAsc(lawyerId, clientId)
                .stream()
                .map(MessageResponseDto::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MessageResponseDto> getAllMessages(String lawyerId) {
        return messageRepository.findByLawyerIdOrderBySentAtDesc(lawyerId)
                .stream()
                .map(MessageResponseDto::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public MessageResponseDto getMessageById(String lawyerId, Long id) {
        Message message = messageRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + id));
        return MessageResponseDto.fromEntity(message);
    }

    @Override
    public MessageResponseDto markAsRead(String lawyerId, Long id) {
        Message message = messageRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + id));
        message.setRead(true);
        Message updated = messageRepository.save(message);
        return MessageResponseDto.fromEntity(updated);
    }

    @Override
    public void deleteMessage(String lawyerId, Long id) {
        Message message = messageRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + id));
        messageRepository.delete(message);
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnreadMessages(String lawyerId, Long clientId) {
        if (clientId != null) {
            return messageRepository.countByLawyerIdAndClientIdAndReadFalse(lawyerId, clientId);
        }
        return messageRepository.countByLawyerIdAndReadFalse(lawyerId);
    }
}

