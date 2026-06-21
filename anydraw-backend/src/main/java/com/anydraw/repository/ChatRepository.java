package com.anydraw.repository;

import com.anydraw.model.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface ChatRepository extends JpaRepository<Chat, Integer> {
    List<Chat> findByRoomIdOrderByIdAsc(Integer roomId);
    
    @Transactional
    void deleteByRoomId(Integer roomId);
}
