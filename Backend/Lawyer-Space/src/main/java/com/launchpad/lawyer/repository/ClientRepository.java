package com.launchpad.lawyer.repository;

import com.launchpad.lawyer.entity.Client;
import com.launchpad.lawyer.entity.ClientStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    List<Client> findByLawyerId(String lawyerId);

    Optional<Client> findByLawyerIdAndId(String lawyerId, Long id);

    List<Client> findByLawyerIdAndStatus(String lawyerId, ClientStatus status);

    @Query("SELECT c FROM Client c WHERE c.lawyerId = :lawyerId " +
           "AND (:status IS NULL OR c.status = :status) " +
           "AND (:query IS NULL OR :query = '' OR " +
           "LOWER(c.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.company) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(c.phone) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Client> searchClients(
            @Param("lawyerId") String lawyerId,
            @Param("query") String query,
            @Param("status") ClientStatus status
    );
}
