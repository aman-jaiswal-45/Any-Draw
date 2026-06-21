package com.anydraw.service;

import com.anydraw.dto.CreateRoomRequest;
import com.anydraw.model.Room;
import com.anydraw.model.User;
import com.anydraw.repository.RoomRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserService userService;

    public RoomService(RoomRepository roomRepository, UserService userService) {
        this.roomRepository = roomRepository;
        this.userService = userService;
    }

    public Room createRoom(CreateRoomRequest request, String adminId) throws Exception {
        if (roomRepository.existsBySlug(request.getName())) {
            throw new IllegalArgumentException("Room already exists with this name");
        }

        User admin = userService.getUserById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        Room room = Room.builder()
                .slug(request.getName())
                .admin(admin)
                .build();

        return roomRepository.save(room);
    }

    public List<Room> getRoomsByAdmin(String adminId) {
        return roomRepository.findByAdminIdOrderByIdDesc(adminId);
    }

    public Optional<Room> getRoomBySlug(String slug) {
        return roomRepository.findBySlug(slug);
    }

    public Optional<Room> getRoomById(Integer id) {
        return roomRepository.findById(id);
    }
}
