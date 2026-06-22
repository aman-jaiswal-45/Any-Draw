package com.anydraw.controller;

import com.anydraw.dto.CreateRoomRequest;
import com.anydraw.model.Room;
import com.anydraw.service.RoomService;
import com.anydraw.websocket.DrawingWebSocketHandler;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RoomController {

    private final RoomService roomService;
    private final DrawingWebSocketHandler webSocketHandler;

    public RoomController(RoomService roomService, DrawingWebSocketHandler webSocketHandler) {
        this.roomService = roomService;
        this.webSocketHandler = webSocketHandler;
    }

    @PostMapping("/room")
    public ResponseEntity<?> createRoom(@Valid @RequestBody CreateRoomRequest request) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        try {
            Room room = roomService.createRoom(request, userId);
            Map<String, Object> response = new HashMap<>();
            response.put("roomId", room.getId());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/rooms")
    public ResponseEntity<?> getUserRooms() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        List<Room> rooms = roomService.getRoomsByAdmin(userId);
        
        List<com.anydraw.model.JoinedRoom> joinedRelations = roomService.getJoinedRoomsForUser(userId);
        List<Room> joinedRooms = joinedRelations.stream()
                .map(com.anydraw.model.JoinedRoom::getRoom)
                .collect(java.util.stream.Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("rooms", rooms);
        response.put("joinedRooms", joinedRooms);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/room/{slug}")
    public ResponseEntity<?> getRoomBySlug(@PathVariable String slug) {
        return roomService.getRoomBySlug(slug)
                .map(room -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("room", room);
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("room", null);
                    return ResponseEntity.ok(response);
                });
    }

    @DeleteMapping("/room/{id}")
    public ResponseEntity<?> deleteRoom(@PathVariable Integer id) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        try {
            roomService.deleteRoom(id, userId);
            webSocketHandler.notifyRoomDeletion(String.valueOf(id));
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Room deleted successfully");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (org.springframework.security.access.AccessDeniedException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping("/room/{roomId}/join-request")
    public ResponseEntity<?> requestJoinRoom(@PathVariable Integer roomId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        try {
            String status = roomService.checkAndJoinRoom(roomId, userId);
            Map<String, Object> response = new HashMap<>();
            response.put("status", status);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    @PostMapping("/room/{roomId}/approve/{targetUserId}")
    public ResponseEntity<?> approveJoin(@PathVariable Integer roomId, @PathVariable String targetUserId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String adminId = (String) principal;
        try {
            roomService.approvePendingRequest(roomId, targetUserId, adminId);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Request approved successfully");
            return ResponseEntity.ok(response);
        } catch (org.springframework.security.access.AccessDeniedException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    @PostMapping("/room/{roomId}/reject/{targetUserId}")
    public ResponseEntity<?> rejectJoin(@PathVariable Integer roomId, @PathVariable String targetUserId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String adminId = (String) principal;
        try {
            roomService.rejectPendingRequest(roomId, targetUserId, adminId);
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Request rejected successfully");
            return ResponseEntity.ok(response);
        } catch (org.springframework.security.access.AccessDeniedException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    @GetMapping("/room/{roomId}/pending-requests")
    public ResponseEntity<?> getPendingRequests(@PathVariable Integer roomId) {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal == null || !(principal instanceof String)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Unauthorized");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        String userId = (String) principal;
        // Verify user is admin or joined before seeing requests
        if (!roomService.isUserJoinedOrAdmin(roomId, userId)) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Forbidden");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
        }

        List<com.anydraw.model.PendingRequest> requests = roomService.getPendingRequestsForRoom(roomId);
        Map<String, Object> response = new HashMap<>();
        response.put("requests", requests);
        return ResponseEntity.ok(response);
    }
}
