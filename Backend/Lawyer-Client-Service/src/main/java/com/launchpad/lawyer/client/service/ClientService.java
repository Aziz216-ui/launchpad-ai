package com.launchpad.lawyer.client.service;

import com.launchpad.lawyer.client.dto.ClientRequestDto;
import com.launchpad.lawyer.client.dto.ClientResponseDto;
import com.launchpad.lawyer.client.entity.Client;
import com.launchpad.lawyer.client.entity.ClientStatus;

import java.util.List;

public interface ClientService {

    ClientResponseDto createClient(String lawyerId, ClientRequestDto dto);

    List<ClientResponseDto> searchAndFilterClients(String lawyerId, String query, ClientStatus status);

    ClientResponseDto getClientById(String lawyerId, Long id);

    Client getClientEntity(String lawyerId, Long id);

    ClientResponseDto updateClient(String lawyerId, Long id, ClientRequestDto dto);

    ClientResponseDto archiveClient(String lawyerId, Long id);

    void deleteClient(String lawyerId, Long id);
}

