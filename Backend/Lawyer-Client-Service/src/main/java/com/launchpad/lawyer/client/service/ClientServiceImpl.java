package com.launchpad.lawyer.client.service;

import com.launchpad.lawyer.client.dto.ClientRequestDto;
import com.launchpad.lawyer.client.dto.ClientResponseDto;
import com.launchpad.lawyer.client.entity.Client;
import com.launchpad.lawyer.client.entity.ClientStatus;
import com.launchpad.lawyer.client.exception.ResourceNotFoundException;
import com.launchpad.lawyer.client.messaging.ClientEventPublisher;
import com.launchpad.lawyer.client.repository.ClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ClientServiceImpl implements ClientService {

    private final ClientRepository clientRepository;
    private final ClientEventPublisher eventPublisher;

    public ClientServiceImpl(ClientRepository clientRepository, ClientEventPublisher eventPublisher) {
        this.clientRepository = clientRepository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public ClientResponseDto createClient(String lawyerId, ClientRequestDto dto) {
        Client client = new Client();
        client.setLawyerId(lawyerId);
        client.setFirstName(dto.firstName());
        client.setLastName(dto.lastName());
        client.setEmail(dto.email());
        client.setPhone(dto.phone());
        client.setCompany(dto.company());
        client.setAddress(dto.address());
        client.setNotes(dto.notes());
        client.setStatus(dto.status() != null ? dto.status() : ClientStatus.ACTIVE);

        Client saved = clientRepository.save(client);

        // RabbitMQ Asynchronous Event
        eventPublisher.publishClientEvent("CREATED", saved.getId(), saved.getLawyerId(),
                saved.getFirstName() + " " + saved.getLastName(), saved.getEmail(), saved.getStatus().name());

        return ClientResponseDto.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClientResponseDto> searchAndFilterClients(String lawyerId, String query, ClientStatus status) {
        return clientRepository.searchClients(lawyerId, query, status)
                .stream()
                .map(ClientResponseDto::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ClientResponseDto getClientById(String lawyerId, Long id) {
        Client client = clientRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + id));
        return ClientResponseDto.fromEntity(client);
    }

    @Override
    public Client getClientEntity(String lawyerId, Long id) {
        return clientRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + id));
    }

    @Override
    public ClientResponseDto updateClient(String lawyerId, Long id, ClientRequestDto dto) {
        Client client = getClientEntity(lawyerId, id);

        if (dto.firstName() != null) client.setFirstName(dto.firstName());
        if (dto.lastName() != null) client.setLastName(dto.lastName());
        if (dto.email() != null) client.setEmail(dto.email());
        if (dto.phone() != null) client.setPhone(dto.phone());
        if (dto.company() != null) client.setCompany(dto.company());
        if (dto.address() != null) client.setAddress(dto.address());
        if (dto.notes() != null) client.setNotes(dto.notes());
        if (dto.status() != null) client.setStatus(dto.status());

        Client updated = clientRepository.save(client);

        eventPublisher.publishClientEvent("UPDATED", updated.getId(), updated.getLawyerId(),
                updated.getFirstName() + " " + updated.getLastName(), updated.getEmail(), updated.getStatus().name());

        return ClientResponseDto.fromEntity(updated);
    }

    @Override
    public ClientResponseDto archiveClient(String lawyerId, Long id) {
        Client client = getClientEntity(lawyerId, id);
        client.setStatus(ClientStatus.ARCHIVED);
        Client saved = clientRepository.save(client);

        eventPublisher.publishClientEvent("ARCHIVED", saved.getId(), saved.getLawyerId(),
                saved.getFirstName() + " " + saved.getLastName(), saved.getEmail(), saved.getStatus().name());

        return ClientResponseDto.fromEntity(saved);
    }

    @Override
    public void deleteClient(String lawyerId, Long id) {
        Client client = getClientEntity(lawyerId, id);
        clientRepository.delete(client);

        eventPublisher.publishClientEvent("DELETED", client.getId(), client.getLawyerId(),
                client.getFirstName() + " " + client.getLastName(), client.getEmail(), "DELETED");
    }
}

