package com.launchpad.lawyer.repository;

import com.launchpad.lawyer.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByLawyerIdAndClientIdOrderBySentAtAsc(String lawyerId, Long clientId);

    List<Message> findByLawyerIdOrderBySentAtDesc(String lawyerId);

    List<Message> findByLawyerIdAndReadFalse(String lawyerId);
}
