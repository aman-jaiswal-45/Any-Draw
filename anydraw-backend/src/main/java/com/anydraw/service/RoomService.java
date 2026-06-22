package com.anydraw.service;

import com.anydraw.dto.CreateRoomRequest;
import com.anydraw.model.Room;
import com.anydraw.model.User;
import com.anydraw.model.JoinedRoom;
import com.anydraw.repository.RoomRepository;
import com.anydraw.repository.JoinedRoomRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserService userService;
    private final JoinedRoomRepository joinedRoomRepository;

    public RoomService(RoomRepository roomRepository, UserService userService, JoinedRoomRepository joinedRoomRepository) {
        this.roomRepository = roomRepository;
        this.userService = userService;
        this.joinedRoomRepository = joinedRoomRepository;
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

    public void recordUserJoin(Integer roomId, String userId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return;

        // If the user is the admin of the room, do not record as joined room
        if (room.getAdmin().getId().equals(userId)) return;

        User user = userService.getUserById(userId).orElse(null);
        if (user == null) return;

        if (!joinedRoomRepository.existsByUserIdAndRoomId(userId, roomId)) {
            JoinedRoom joined = JoinedRoom.builder()
                    .user(user)
                    .room(room)
                    .joinedAt(LocalDateTime.now())
                    .build();
            joinedRoomRepository.save(joined);
        }
    }

    public List<JoinedRoom> getJoinedRoomsForUser(String userId) {
        return joinedRoomRepository.findByUserIdOrderByJoinedAtDesc(userId);
    }
}
