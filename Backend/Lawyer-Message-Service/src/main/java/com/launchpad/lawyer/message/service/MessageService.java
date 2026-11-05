package com.launchpad.lawyer.message.service;

import com.launchpad.lawyer.message.dto.MessageRequestDto;
import com.launchpad.lawyer.message.dto.MessageResponseDto;

import java.util.List;

public interface MessageService {

    MessageResponseDto sendMessage(String lawyerId, MessageRequestDto dto);

    List<MessageResponseDto> getMessagesByClient(String lawyerId, Long clientId);

    List<MessageResponseDto> getAllMessages(String lawyerId);

    MessageResponseDto getMessageById(String lawyerId, Long id);

    MessageResponseDto markAsRead(String lawyerId, Long id);

    void deleteMessage(String lawyerId, Long id);

    long countUnreadMessages(String lawyerId, Long clientId);
}

