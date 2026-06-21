package com.anydraw.repository;

import com.anydraw.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer> {
    Optional<Room> findBySlug(String slug);
    List<Room> findByAdminIdOrderByIdDesc(String adminId);
    boolean existsBySlug(String slug);
}
