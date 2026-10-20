package com.launchpad.lawyer.service;

import com.launchpad.lawyer.dto.ClientRequestDto;
import com.launchpad.lawyer.dto.ClientResponseDto;
import com.launchpad.lawyer.entity.Client;
import com.launchpad.lawyer.entity.ClientStatus;
import com.launchpad.lawyer.exception.ResourceNotFoundException;
import com.launchpad.lawyer.repository.ClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ClientService {

    private final ClientRepository clientRepository;

    public ClientService(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

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
        return ClientResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<ClientResponseDto> searchAndFilterClients(String lawyerId, String query, ClientStatus status) {
        return clientRepository.searchClients(lawyerId, query, status)
                .stream()
                .map(ClientResponseDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClientResponseDto getClientById(String lawyerId, Long id) {
        Client client = clientRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + id));
        return ClientResponseDto.fromEntity(client);
    }

    public Client getClientEntity(String lawyerId, Long id) {
        return clientRepository.findByLawyerIdAndId(lawyerId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Client not found with id: " + id));
    }

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
        return ClientResponseDto.fromEntity(updated);
    }

    public ClientResponseDto archiveClient(String lawyerId, Long id) {
        Client client = getClientEntity(lawyerId, id);
        client.setStatus(ClientStatus.ARCHIVED);
        Client saved = clientRepository.save(client);
        return ClientResponseDto.fromEntity(saved);
    }
}
