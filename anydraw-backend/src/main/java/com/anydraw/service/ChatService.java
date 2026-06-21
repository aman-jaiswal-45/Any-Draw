package com.anydraw.service;

import com.anydraw.model.Chat;
import com.anydraw.model.Room;
import com.anydraw.model.User;
import com.anydraw.repository.ChatRepository;
import com.anydraw.websocket.StoredShape;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ChatService {

    private final ChatRepository chatRepository;
    private final RoomService roomService;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    public ChatService(
            ChatRepository chatRepository,
            RoomService roomService,
            UserService userService,
            ObjectMapper objectMapper
    ) {
        this.chatRepository = chatRepository;
        this.roomService = roomService;
        this.userService = userService;
        this.objectMapper = objectMapper;
    }

    public List<Chat> getChatsByRoomId(Integer roomId) {
        return chatRepository.findByRoomIdOrderByIdAsc(roomId);
    }

    @Transactional
    public void persistRoomChats(Integer roomId, String disconnectingUserId, List<StoredShape> shapes) throws Exception {
        // Delete old canvas logs for this room
        chatRepository.deleteByRoomId(roomId);

        // Fetch room and user models
        Optional<Room> roomOpt = roomService.getRoomById(roomId);
        Optional<User> userOpt = userService.getUserById(disconnectingUserId);

        if (roomOpt.isPresent()) {
            Room room = roomOpt.get();
            User user = userOpt.orElse(room.getAdmin()); // Fallback to room admin

            List<Chat> chatsToSave = new ArrayList<>();
            for (StoredShape shape : shapes) {
                ObjectNode messageWrapper = objectMapper.createObjectNode();
                messageWrapper.set("shape", shape.getShape());

                Chat chat = Chat.builder()
                        .room(room)
                        .user(user)
                        .message(objectMapper.writeValueAsString(messageWrapper))
                        .build();
                chatsToSave.add(chat);
            }
            
            chatRepository.saveAll(chatsToSave);
            System.out.println("Successfully persisted " + chatsToSave.size() + " shapes in DB for Room: " + roomId);
        } else {
            System.err.println("Cannot persist shapes: Room ID " + roomId + " not found in DB.");
        }
    }
}
