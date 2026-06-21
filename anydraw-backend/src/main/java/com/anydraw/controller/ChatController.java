package com.anydraw.controller;

import com.anydraw.model.Chat;
import com.anydraw.service.ChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/chats/{roomId}")
    public ResponseEntity<?> getRoomChats(@PathVariable Integer roomId) {
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
