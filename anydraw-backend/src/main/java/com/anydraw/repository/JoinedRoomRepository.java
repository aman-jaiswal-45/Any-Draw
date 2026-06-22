package com.anydraw.repository;

import com.anydraw.model.JoinedRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface JoinedRoomRepository extends JpaRepository<JoinedRoom, Integer> {
    boolean existsByUserIdAndRoomId(String userId, Integer roomId);
    List<JoinedRoom> findByUserIdOrderByJoinedAtDesc(String userId);

    @Transactional
    void deleteByRoomId(Integer roomId);

    @Transactional
    void deleteByUserIdAndRoomId(String userId, Integer roomId);
}
