package com.launchpad.lawyer.inforequest.service;

import com.launchpad.lawyer.inforequest.dto.InformationRequestDto;
import com.launchpad.lawyer.inforequest.dto.InformationRequestResponseDto;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;

import java.util.List;

public interface InformationRequestService {

    InformationRequestResponseDto createInformationRequest(String lawyerId, InformationRequestDto dto);

    List<InformationRequestResponseDto> getInformationRequests(String lawyerId, Long clientId, RequestStatus status);

    InformationRequestResponseDto getInformationRequestById(String lawyerId, Long id);

    InformationRequestResponseDto updateInformationRequestStatus(String lawyerId, Long requestId, RequestStatus newStatus);

    InformationRequestResponseDto updateInformationRequest(String lawyerId, Long id, InformationRequestDto dto);

    void deleteInformationRequest(String lawyerId, Long id);
}

