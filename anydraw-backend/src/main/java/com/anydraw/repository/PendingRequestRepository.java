package com.anydraw.repository;

import com.anydraw.model.PendingRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Repository
public interface PendingRequestRepository extends JpaRepository<PendingRequest, Integer> {
    boolean existsByUserIdAndRoomId(String userId, Integer roomId);
    Optional<PendingRequest> findByUserIdAndRoomId(String userId, Integer roomId);
    List<PendingRequest> findByRoomIdOrderByCreatedAtAsc(Integer roomId);
    List<PendingRequest> findByRoomIdAndStatusOrderByCreatedAtAsc(Integer roomId, String status);
    
    @Transactional
    void deleteByUserIdAndRoomId(String userId, Integer roomId);

    @Transactional
    void deleteByRoomId(Integer roomId);
}
