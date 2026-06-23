package com.anydraw.controller;

import com.anydraw.model.Chat;
import com.anydraw.service.ChatService;
import com.anydraw.service.RoomService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;
    private final RoomService roomService;

    public ChatController(ChatService chatService, RoomService roomService) {
        this.chatService = chatService;
        this.roomService = roomService;
    }

    @GetMapping("/chats/{roomId}")
    public ResponseEntity<?> getRoomChats(@PathVariable Integer roomId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        if (!roomService.isUserJoinedOrAdmin(roomId, userId)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Access Denied. You are not authorized to view the contents of this room.");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        try {
            List<Chat> chats = chatService.getChatsByRoomId(roomId);
            Map<String, Object> response = new HashMap<>();
            response.put("messages", chats);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("messages", List.of());
            return ResponseEntity.ok(response);
        }
    }
}
