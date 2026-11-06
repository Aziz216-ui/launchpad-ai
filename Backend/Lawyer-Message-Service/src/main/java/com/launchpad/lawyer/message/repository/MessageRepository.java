package com.launchpad.lawyer.message.repository;

import com.launchpad.lawyer.message.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByLawyerIdAndClientIdOrderBySentAtAsc(String lawyerId, Long clientId);

    List<Message> findByLawyerIdOrderBySentAtDesc(String lawyerId);

    Optional<Message> findByLawyerIdAndId(String lawyerId, Long id);

    List<Message> findByLawyerIdAndReadFalse(String lawyerId);

    long countByLawyerIdAndReadFalse(String lawyerId);

    long countByLawyerIdAndClientIdAndReadFalse(String lawyerId, Long clientId);
}

