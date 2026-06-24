package com.anydraw.websocket;

import com.anydraw.config.JwtService;
import com.anydraw.model.Chat;
import com.anydraw.service.ChatService;
import com.anydraw.service.RoomService;
import com.anydraw.service.UserService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class DrawingWebSocketHandler extends TextWebSocketHandler {

    private final UserService userService;
    private final RoomService roomService;
    private final ChatService chatService;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    // In-memory states
    private final ConcurrentHashMap<String, RoomState> activeRooms = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<WebSocketSession>> pendingSessions = new ConcurrentHashMap<>();

    public DrawingWebSocketHandler(
            UserService userService,
            RoomService roomService,
            ChatService chatService,
            JwtService jwtService,
            ObjectMapper objectMapper
    ) {
        this.userService = userService;
        this.roomService = roomService;
        this.chatService = chatService;
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
    }

    @jakarta.annotation.PreDestroy
    public void onShutdown() {
        System.out.println("Spring Boot is shutting down cleanly. Persisting all active room states...");
        for (Map.Entry<String, RoomState> entry : activeRooms.entrySet()) {
            String roomId = entry.getKey();
            RoomState roomState = entry.getValue();
            if (roomState != null && !roomState.getShapes().isEmpty()) {
                try {
                    Integer roomDbId = Integer.parseInt(roomId);
                    String adminId = "";
                    com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
                    if (roomObj != null) {
                        adminId = roomObj.getAdmin().getId();
                    }
                    chatService.persistRoomChats(roomDbId, adminId, roomState.getShapes());
                    System.out.println("Successfully persisted " + roomState.getShapes().size() + " shapes for Room ID: " + roomId + " on shutdown.");
                } catch (Exception e) {
                    System.err.println("Failed to persist Room: " + roomId + " on shutdown. Error: " + e.getMessage());
                }
            }
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String query = session.getUri().getQuery();
        String token = null;
        boolean joinRequest = false;
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("token=")) {
                    token = param.substring(6);
                } else if (param.equals("joinRequest=true")) {
                    joinRequest = true;
                }
            }
        }

        if (token == null || !jwtService.isTokenValid(token)) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String userId = jwtService.extractUserId(token);
        session.getAttributes().put("userId", userId);
        session.getAttributes().put("joinRequest", joinRequest);
        session.getAttributes().put("rooms", new CopyOnWriteArraySet<String>());
        System.out.println("WebSocket connected for User ID: " + userId + ", joinRequest=" + joinRequest);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        JsonNode data;
        try {
            data = objectMapper.readTree(payload);
        } catch (Exception e) {
            return;
        }

        if (!data.has("type") || !data.has("roomId")) return;

        String type = data.get("type").asText();
        String roomId = data.get("roomId").asText();

        // Validate write permission for drawing actions
        if (type.equals("chat") || type.equals("update") || type.equals("delete") || type.equals("undo") || type.equals("redo")) {
            String userId = (String) session.getAttributes().get("userId");
            boolean isAdmin = false;
            try {
                Integer roomDbId = Integer.parseInt(roomId);
                com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
                if (roomObj != null && roomObj.getAdmin().getId().equals(userId)) {
                    isAdmin = true;
                }
            } catch (Exception e) {
                // Ignore parse errors
            }

            if (!isAdmin) {
                // 1. Check if room is globally locked in memory
                RoomState roomState = activeRooms.get(roomId);
                if (roomState != null && roomState.isLocked()) {
                    System.out.println("Blocked write action '" + type + "' from user: " + userId + " - Room is globally frozen.");
                    return;
                }

                // 2. Check individual collaborator permissions (must have WRITE role)
                @SuppressWarnings("unchecked")
                Map<String, String> roles = (Map<String, String>) session.getAttributes().get("roles");
                String userRole = (roles != null) ? roles.getOrDefault(roomId, "READ_ONLY") : "READ_ONLY";
                if (!"WRITE".equalsIgnoreCase(userRole)) {
                    System.out.println("Blocked unauthorized draw action '" + type + "' from user: " + userId);
                    return;
                }
            }
        }

        // Validate laser pointer permission
        if (type.equals("laser_move") || type.equals("laser_stop")) {
            String userId = (String) session.getAttributes().get("userId");
            boolean isAdmin = false;
            try {
                Integer roomDbId = Integer.parseInt(roomId);
                com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
                if (roomObj != null && roomObj.getAdmin().getId().equals(userId)) {
                    isAdmin = true;
                }
            } catch (Exception e) {
                // Ignore parse errors
            }

            if (!isAdmin) {
                @SuppressWarnings("unchecked")
                Map<String, String> roles = (Map<String, String>) session.getAttributes().get("roles");
                String userRole = (roles != null) ? roles.getOrDefault(roomId, "READ_ONLY") : "READ_ONLY";
                if ("READ_ONLY".equalsIgnoreCase(userRole)) {
                    System.out.println("Blocked unauthorized laser action '" + type + "' from user: " + userId);
                    return;
                }
            }
        }

        switch (type) {
            case "join_room":
                handleJoinRoom(session, roomId);
                break;
            case "leave_room":
                handleLeaveRoom(session, roomId);
                break;
            case "chat":
                handleCreateShape(session, roomId, data);
                break;
            case "update":
                handleUpdateShape(session, roomId, data);
                break;
            case "delete":
                handleDeleteShape(session, roomId, data);
                break;
            case "reorder":
                handleReorder(session, roomId, data);
                break;
            case "clear":
                handleClearCanvas(session, roomId);
                break;
            case "laser_move":
                handleLaserMove(session, roomId, data);
                break;
            case "laser_stop":
                handleLaserStop(session, roomId, data);
                break;
            case "undo":
                handleUndo(roomId);
                break;
            case "redo":
                handleRedo(roomId);
                break;
            case "approve_join":
                handleApproveJoin(session, roomId, data);
                break;
            case "reject_join":
                handleRejectJoin(session, roomId, data);
                break;
            case "remove_user":
                handleRemoveUser(session, roomId, data);
                break;
            case "toggle_write_permission":
                handleToggleWritePermission(session, roomId, data);
                break;
            case "toggle_room_lock":
                handleToggleRoomLock(session, roomId, data);
                break;
            case "block_user":
                handleBlockUser(session, roomId, data);
                break;
            case "unblock_user":
                handleUnblockUser(session, roomId, data);
                break;
            default:
                System.out.println("Unknown WS action type: " + type);
        }
    }

    private void handleJoinRoom(WebSocketSession session, String roomId) throws IOException {
        @SuppressWarnings("unchecked")
        Set<String> sessionRooms = (Set<String>) session.getAttributes().get("rooms");
        sessionRooms.add(roomId);

        Integer roomDbId;
        try {
            roomDbId = Integer.parseInt(roomId);
        } catch (NumberFormatException e) {
            System.err.println("Invalid Room ID layout: " + roomId);
            return;
        }

        String userId = (String) session.getAttributes().get("userId");
        Boolean joinRequest = (Boolean) session.getAttributes().getOrDefault("joinRequest", false);

        if (Boolean.TRUE.equals(joinRequest)) {
            roomService.resetRejectionIfAny(roomDbId, userId);
        }

        boolean isApproved = roomService.isUserJoinedOrAdmin(roomDbId, userId);

        if (isApproved) {
            roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);

            // Determine if current user can write and what their role is
            com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
            String role = "READ_ONLY";
            boolean canWrite = false;
            if (roomObj != null) {
                role = roomObj.getAdmin().getId().equals(userId) ? "WRITE" : roomService.getUserRole(roomDbId, userId);
                canWrite = "WRITE".equalsIgnoreCase(role);
            }
            @SuppressWarnings("unchecked")
            Map<String, String> roles = (Map<String, String>) session.getAttributes()
                    .computeIfAbsent("roles", k -> new java.util.concurrent.ConcurrentHashMap<>());
            roles.put(roomId, role);

            @SuppressWarnings("unchecked")
            Map<String, Boolean> permissions = (Map<String, Boolean>) session.getAttributes()
                    .computeIfAbsent("permissions", k -> new java.util.concurrent.ConcurrentHashMap<>());
            permissions.put(roomId, canWrite);

            // Load or initialize room state
            RoomState roomState = activeRooms.get(roomId);
            if (roomState == null) {
                roomState = new RoomState();
                if (roomObj != null) {
                    roomState.setLocked(roomObj.getIsLocked());
                }
                try {
                    List<Chat> existingChats = chatService.getChatsByRoomId(roomDbId);
                    for (Chat entry : existingChats) {
                        if (entry.getMessage() != null) {
                            try {
                                JsonNode parsed = objectMapper.readTree(entry.getMessage());
                                if (parsed.has("shape")) {
                                    roomState.getShapes().add(new StoredShape(String.valueOf(entry.getId()), parsed.get("shape")));
                                }
                            } catch (Exception err) {
                                // Skip corrupted logs
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Failed to load room state: " + e.getMessage());
                }
                activeRooms.put(roomId, roomState);
            }

            // Return room shapes to the joining client
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "room_state");
            response.put("roomId", roomId);
            response.put("role", role);
            response.put("canWrite", canWrite);
            response.put("isLocked", roomState.isLocked());
            ArrayNode shapesNode = response.putArray("shapes");
            synchronized (roomState) {
                for (StoredShape shape : roomState.getShapes()) {
                    ObjectNode shapeNode = shapesNode.addObject();
                    shapeNode.put("id", shape.getId());
                    shapeNode.set("shape", shape.getShape());
                }
            }
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
            System.out.println("User joined Room: " + roomId + ". Sent current shape count: " + roomState.getShapes().size());

            // If this user is the room creator, load all pending and blocked requests and send them
            if (roomObj != null && roomObj.getAdmin().getId().equals(userId)) {
                sendPendingRequestsToAdmin(session, roomDbId, roomId);
                sendBlockedUsersToAdmin(session, roomDbId, roomId);
            }

            // Broadcast collaborator list update to the room
            broadcastCollaboratorList(roomId);
        } else {
            // Record request in DB
            String joinStatus = roomService.checkAndJoinRoom(roomDbId, userId);

            if ("BLOCKED".equals(joinStatus)) {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_blocked");
                response.put("roomId", roomId);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                session.close(CloseStatus.NORMAL);
                return;
            }

            if ("REJECTED".equals(joinStatus)) {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_rejected");
                response.put("roomId", roomId);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                session.close(CloseStatus.NORMAL);
                return;
            }

            // Put in pendingSessions map
            pendingSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);

            // Notify user they are pending approval
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "pending_approval");
            response.put("roomId", roomId);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));

            // Query user details
            com.anydraw.model.User targetUser = userService.getUserById(userId).orElse(null);
            String userName = targetUser != null ? targetUser.getName() : "Unknown User";
            String userEmail = targetUser != null ? targetUser.getEmail() : "";

            // Check if admin is online to alert them in real-time
            com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
            String adminId = roomObj != null ? roomObj.getAdmin().getId() : null;
            boolean adminOnline = false;

            if (adminId != null) {
                Set<WebSocketSession> activeSessions = roomSessions.get(roomId);
                if (activeSessions != null) {
                    for (WebSocketSession s : activeSessions) {
                        String sUserId = (String) s.getAttributes().get("userId");
                        if (adminId.equals(sUserId)) {
                            adminOnline = true;
                            // Send join request to admin
                            ObjectNode adminReq = objectMapper.createObjectNode();
                            adminReq.put("type", "join_request");
                            adminReq.put("roomId", roomId);
                            adminReq.put("userId", userId);
                            adminReq.put("userName", userName);
                            adminReq.put("userEmail", userEmail);
                            s.sendMessage(new TextMessage(objectMapper.writeValueAsString(adminReq)));
                            System.out.println("Forwarded join request from " + userId + " to admin " + adminId);
                        }
                    }
                }
            }

            if (!adminOnline) {
                // Inform user the admin is currently offline
                ObjectNode offlineMsg = objectMapper.createObjectNode();
                offlineMsg.put("type", "admin_status");
                offlineMsg.put("roomId", roomId);
                offlineMsg.put("status", "offline");
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(offlineMsg)));
            }
        }
    }

    private void handleLeaveRoom(WebSocketSession session, String roomId) {
        @SuppressWarnings("unchecked")
        Set<String> sessionRooms = (Set<String>) session.getAttributes().get("rooms");
        if (sessionRooms != null) {
            sessionRooms.remove(roomId);
        }

        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                roomSessions.remove(roomId);
                String userId = (String) session.getAttributes().get("userId");
                persistRoomState(roomId, userId);
            } else {
                broadcastCollaboratorList(roomId);
            }
        }

        Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
        if (pSessions != null) {
            pSessions.remove(session);
            if (pSessions.isEmpty()) {
                pendingSessions.remove(roomId);
            }
        }
    }

    private boolean isUserAdmin(String roomId, String userId) {
        try {
            Integer roomDbId = Integer.parseInt(roomId);
            com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
            return roomObj != null && roomObj.getAdmin().getId().equals(userId);
        } catch (Exception e) {
            return false;
        }
    }

    private void handleCreateShape(WebSocketSession session, String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String tempId = data.has("tempId") ? data.get("tempId").asText() : null;
        JsonNode shape = data.get("shape");
        String userId = (String) session.getAttributes().get("userId");

        // Inject createdBy in shape metadata
        if (shape instanceof ObjectNode) {
            ((ObjectNode) shape).put("createdBy", userId);
        }

        StoredShape newShape;
        String shapeId = "local-" + System.currentTimeMillis();
        
        synchronized (roomState) {
            roomState.saveState();
            newShape = new StoredShape(shapeId, shape);
            roomState.getShapes().add(newShape);
        }

        // Broadcast new shape to room members
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "chat");
        broadcast.put("id", shapeId);
        if (tempId != null) {
            broadcast.put("tempId", tempId);
        }
        broadcast.set("shape", shape);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleUpdateShape(WebSocketSession session, String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String shapeId = data.get("id").asText();
        JsonNode shape = data.get("shape");
        String userId = (String) session.getAttributes().get("userId");
        boolean isAdmin = isUserAdmin(roomId, userId);

        synchronized (roomState) {
            // Find existing shape
            StoredShape existingShape = null;
            for (StoredShape s : roomState.getShapes()) {
                if (s.getId().equals(shapeId)) {
                    existingShape = s;
                    break;
                }
            }

            if (existingShape == null) {
                return;
            }

            // Verify ownership
            String createdBy = null;
            if (existingShape.getShape().has("createdBy")) {
                createdBy = existingShape.getShape().get("createdBy").asText();
            }

            if (!isAdmin && (createdBy == null || !createdBy.equals(userId))) {
                System.out.println("Blocked unauthorized update shape request for shape " + shapeId + " from user " + userId);
                return;
            }

            // Enforce createdBy field in updated shape
            if (shape instanceof ObjectNode) {
                if (createdBy != null) {
                    ((ObjectNode) shape).put("createdBy", createdBy);
                } else {
                    ((ObjectNode) shape).remove("createdBy");
                }
            }

            roomState.saveState();
            existingShape.setShape(shape);
        }

        // Broadcast shape update
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "update");
        broadcast.put("id", shapeId);
        broadcast.set("shape", shape);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleDeleteShape(WebSocketSession session, String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String shapeId = data.get("id").asText();
        String userId = (String) session.getAttributes().get("userId");
        boolean isAdmin = isUserAdmin(roomId, userId);

        synchronized (roomState) {
            // Find existing shape
            StoredShape existingShape = null;
            for (StoredShape s : roomState.getShapes()) {
                if (s.getId().equals(shapeId)) {
                    existingShape = s;
                    break;
                }
            }

            if (existingShape == null) {
                return;
            }

            // Verify ownership
            String createdBy = null;
            if (existingShape.getShape().has("createdBy")) {
                createdBy = existingShape.getShape().get("createdBy").asText();
            }

            if (!isAdmin && (createdBy == null || !createdBy.equals(userId))) {
                System.out.println("Blocked unauthorized delete shape request for shape " + shapeId + " from user " + userId);
                return;
            }

            roomState.saveState();
            roomState.getShapes().remove(existingShape);
        }

        // Broadcast deletion
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "delete");
        broadcast.put("id", shapeId);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleReorder(WebSocketSession session, String roomId, JsonNode data) {
        String userId = (String) session.getAttributes().get("userId");
        if (!isUserAdmin(roomId, userId)) {
            System.out.println("Blocked unauthorized reorder request from user " + userId + " - only host is permitted.");
            return;
        }

        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        JsonNode orderNode = data.get("order");
        if (orderNode == null || !orderNode.isArray()) return;

        synchronized (roomState) {
            // Reorder shapes in RoomState
            Map<String, StoredShape> shapeMap = new HashMap<>();
            for (StoredShape s : roomState.getShapes()) {
                shapeMap.put(s.getId(), s);
            }

            List<StoredShape> newList = new ArrayList<>();
            for (JsonNode idNode : orderNode) {
                String id = idNode.asText();
                StoredShape s = shapeMap.remove(id);
                if (s != null) {
                    newList.add(s);
                }
            }
            // Add any remaining shapes (in case of shape id mismatches or additions)
            newList.addAll(shapeMap.values());
            roomState.setShapes(newList);
        }

        // Broadcast reorder to everyone
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "reorder");
        broadcast.set("order", orderNode);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleUndo(String roomId) {
        // Deprecated: client-side smart undo handles individual mutations
    }

    private void handleRedo(String roomId) {
        // Deprecated: client-side smart redo handles individual mutations
    }

    private void broadcastToRoom(String roomId, JsonNode message) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            return;
        }

        TextMessage wsMessage = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(wsMessage);
                } catch (IOException e) {
                    // Ignore transient network errors
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = (String) session.getAttributes().get("userId");
        @SuppressWarnings("unchecked")
        Set<String> sessionRooms = (Set<String>) session.getAttributes().get("rooms");

        if (sessionRooms != null) {
            for (String roomId : sessionRooms) {
                Set<WebSocketSession> sessions = roomSessions.get(roomId);
                if (sessions != null) {
                    sessions.remove(session);
                    
                    if (sessions.isEmpty()) {
                        roomSessions.remove(roomId);
                        persistRoomState(roomId, userId);
                    } else {
                        broadcastCollaboratorList(roomId);
                    }
                }

                Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
                if (pSessions != null) {
                    pSessions.remove(session);
                    if (pSessions.isEmpty()) {
                        pendingSessions.remove(roomId);
                    }
                }
            }
        }
        System.out.println("WebSocket closed for User ID: " + userId);
    }

    private void persistRoomState(String roomId, String disconnectingUserId) {
        RoomState roomState = activeRooms.remove(roomId);
        if (roomState == null) return;

        System.out.println("Persisting final state for Room ID: " + roomId);

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            chatService.persistRoomChats(roomDbId, disconnectingUserId, roomState.getShapes());
        } catch (Exception e) {
            System.err.println("Failed to persist final shapes for Room: " + roomId + ". Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleApproveJoin(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.approvePendingRequest(roomDbId, targetUserId, adminId);

            Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
            WebSocketSession targetSession = null;
            if (pSessions != null) {
                for (WebSocketSession s : pSessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        targetSession = s;
                        break;
                    }
                }
            }

            if (targetSession != null && targetSession.isOpen()) {
                pSessions.remove(targetSession);
                if (pSessions.isEmpty()) {
                    pendingSessions.remove(roomId);
                }
                roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(targetSession);

                // Set in-memory session permission cache for target user (default to WRITE upon approval)
                @SuppressWarnings("unchecked")
                Map<String, String> roles = (Map<String, String>) targetSession.getAttributes()
                        .computeIfAbsent("roles", k -> new java.util.concurrent.ConcurrentHashMap<>());
                roles.put(roomId, "WRITE");

                @SuppressWarnings("unchecked")
                Map<String, Boolean> permissions = (Map<String, Boolean>) targetSession.getAttributes()
                        .computeIfAbsent("permissions", k -> new java.util.concurrent.ConcurrentHashMap<>());
                permissions.put(roomId, true);

                RoomState roomState = activeRooms.get(roomId);

                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_approved");
                response.put("roomId", roomId);
                response.put("role", "WRITE");
                response.put("canWrite", true);
                response.put("isLocked", roomState != null && roomState.isLocked());

                if (roomState == null) {
                    roomState = new RoomState();
                    try {
                        List<Chat> existingChats = chatService.getChatsByRoomId(roomDbId);
                        for (Chat entry : existingChats) {
                            if (entry.getMessage() != null) {
                                try {
                                    JsonNode parsed = objectMapper.readTree(entry.getMessage());
                                    if (parsed.has("shape")) {
                                        roomState.getShapes().add(new StoredShape(String.valueOf(entry.getId()), parsed.get("shape")));
                                    }
                                } catch (Exception err) {
                                    // Skip
                                }
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("Failed to load room state on approve: " + e.getMessage());
                    }
                    activeRooms.put(roomId, roomState);
                }

                ArrayNode shapesNode = response.putArray("shapes");
                synchronized (roomState) {
                    for (StoredShape shape : roomState.getShapes()) {
                        ObjectNode shapeNode = shapesNode.addObject();
                        shapeNode.put("id", shape.getId());
                        shapeNode.set("shape", shape.getShape());
                    }
                }
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                System.out.println("User " + targetUserId + " approved to join Room: " + roomId);

                broadcastCollaboratorList(roomId);
            }

            sendPendingRequestsToAdmin(adminSession, roomDbId, roomId);

        } catch (Exception e) {
            System.err.println("Error in handleApproveJoin: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleRejectJoin(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.rejectPendingRequest(roomDbId, targetUserId, adminId);

            Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
            WebSocketSession targetSession = null;
            if (pSessions != null) {
                for (WebSocketSession s : pSessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        targetSession = s;
                        break;
                    }
                }
            }

            if (targetSession != null && targetSession.isOpen()) {
                pSessions.remove(targetSession);
                if (pSessions.isEmpty()) {
                    pendingSessions.remove(roomId);
                }

                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_rejected");
                response.put("roomId", roomId);
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                targetSession.close(CloseStatus.NORMAL);
                System.out.println("User " + targetUserId + " rejected to join Room: " + roomId);
            }

            sendPendingRequestsToAdmin(adminSession, roomDbId, roomId);

        } catch (Exception e) {
            System.err.println("Error in handleRejectJoin: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleBlockUser(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.blockPendingRequest(roomDbId, targetUserId, adminId);

            // 1. Kick from pending waiting list if present
            Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
            WebSocketSession targetSession = null;
            if (pSessions != null) {
                for (WebSocketSession s : pSessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        targetSession = s;
                        break;
                    }
                }
            }

            if (targetSession != null && targetSession.isOpen()) {
                pSessions.remove(targetSession);
                if (pSessions.isEmpty()) {
                    pendingSessions.remove(roomId);
                }

                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_blocked");
                response.put("roomId", roomId);
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                targetSession.close(CloseStatus.NORMAL);
                System.out.println("User " + targetUserId + " blocked (from pending) in Room: " + roomId);
            }

            // 2. Kick from active collaborators list if present
            Set<WebSocketSession> activeSessions = roomSessions.get(roomId);
            WebSocketSession targetActiveSession = null;
            if (activeSessions != null) {
                for (WebSocketSession s : activeSessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        targetActiveSession = s;
                        break;
                    }
                }
            }

            if (targetActiveSession != null && targetActiveSession.isOpen()) {
                activeSessions.remove(targetActiveSession);
                if (activeSessions.isEmpty()) {
                    roomSessions.remove(roomId);
                }

                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_blocked");
                response.put("roomId", roomId);
                targetActiveSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                targetActiveSession.close(CloseStatus.NORMAL);
                System.out.println("User " + targetUserId + " blocked (from active) in Room: " + roomId);

                broadcastCollaboratorList(roomId);
            }

            sendPendingRequestsToAdmin(adminSession, roomDbId, roomId);
            sendBlockedUsersToAdmin(adminSession, roomDbId, roomId);

        } catch (Exception e) {
            System.err.println("Error in handleBlockUser: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendPendingRequestsToAdmin(WebSocketSession adminSession, Integer roomDbId, String roomId) throws IOException {
        List<com.anydraw.model.PendingRequest> pending = roomService.getPendingRequestsForRoom(roomDbId);
        ObjectNode pendingResponse = objectMapper.createObjectNode();
        pendingResponse.put("type", "admin_pending_requests");
        pendingResponse.put("roomId", roomId);
        ArrayNode requestsNode = pendingResponse.putArray("requests");
        for (com.anydraw.model.PendingRequest req : pending) {
            ObjectNode reqNode = requestsNode.addObject();
            reqNode.put("userId", req.getUser().getId());
            reqNode.put("userName", req.getUser().getName());
            reqNode.put("userEmail", req.getUser().getEmail());
        }
        if (adminSession.isOpen()) {
            adminSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(pendingResponse)));
        }
    }

    private void sendBlockedUsersToAdmin(WebSocketSession adminSession, Integer roomDbId, String roomId) throws IOException {
        List<com.anydraw.model.PendingRequest> blocked = roomService.getBlockedRequestsForRoom(roomDbId);
        ObjectNode blockedResponse = objectMapper.createObjectNode();
        blockedResponse.put("type", "admin_blocked_users");
        blockedResponse.put("roomId", roomId);
        ArrayNode usersNode = blockedResponse.putArray("users");
        for (com.anydraw.model.PendingRequest req : blocked) {
            ObjectNode uNode = usersNode.addObject();
            uNode.put("userId", req.getUser().getId());
            uNode.put("userName", req.getUser().getName());
            uNode.put("userEmail", req.getUser().getEmail());
        }
        if (adminSession.isOpen()) {
            adminSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(blockedResponse)));
        }
    }

    private void handleUnblockUser(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.unblockPendingRequest(roomDbId, targetUserId, adminId);

            sendBlockedUsersToAdmin(adminSession, roomDbId, roomId);
            System.out.println("User " + targetUserId + " unblocked in Room: " + roomId);

        } catch (Exception e) {
            System.err.println("Error in handleUnblockUser: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void broadcastCollaboratorList(String roomId) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        Integer roomDbId = null;
        String adminId = "";
        try {
            roomDbId = Integer.parseInt(roomId);
            com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
            if (roomObj != null) {
                adminId = roomObj.getAdmin().getId();
            }
        } catch (Exception e) {
            // Ignore parse errors
        }

        final Integer finalRoomDbId = roomDbId;
        final String finalAdminId = adminId;

        List<Map<String, Object>> usersList = new ArrayList<>();
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                String uId = (String) s.getAttributes().get("userId");
                if (uId != null) {
                    com.anydraw.model.User user = userService.getUserById(uId).orElse(null);
                    if (user != null) {
                        Map<String, Object> uMap = new HashMap<>();
                        uMap.put("userId", user.getId());
                        uMap.put("userName", user.getName());
                        uMap.put("userEmail", user.getEmail());

                        // Retrieve from session attribute cache or populate if missing
                        @SuppressWarnings("unchecked")
                        Map<String, String> roles = (Map<String, String>) s.getAttributes()
                                .computeIfAbsent("roles", k -> new java.util.concurrent.ConcurrentHashMap<>());
                        String role = roles.computeIfAbsent(roomId, k -> {
                            if (uId.equals(finalAdminId)) return "WRITE";
                            if (finalRoomDbId == null) return "WRITE";
                            try {
                                return roomService.getUserRole(finalRoomDbId, uId);
                            } catch (Exception e) {
                                return "WRITE";
                            }
                        });
                        uMap.put("role", role);
                        uMap.put("canWrite", "WRITE".equalsIgnoreCase(role));

                        usersList.add(uMap);
                    }
                }
            }
        }

        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "collaborators_list");
        msg.put("roomId", roomId);
        ArrayNode collaboratorsNode = msg.putArray("collaborators");
        for (Map<String, Object> u : usersList) {
            ObjectNode uNode = collaboratorsNode.addObject();
            uNode.put("userId", (String) u.get("userId"));
            uNode.put("userName", (String) u.get("userName"));
            uNode.put("userEmail", (String) u.get("userEmail"));
            uNode.put("isHost", u.get("userId").equals(finalAdminId));
            uNode.put("role", (String) u.get("role"));
            uNode.put("canWrite", (Boolean) u.get("canWrite"));
        }

        broadcastToRoom(roomId, msg);
    }

    public void notifyRoomDeletion(String roomId) {
        activeRooms.remove(roomId);

        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions != null) {
            ObjectNode msg = objectMapper.createObjectNode();
            msg.put("type", "room_deleted");
            msg.put("roomId", roomId);
            TextMessage wsMessage;
            try {
                wsMessage = new TextMessage(objectMapper.writeValueAsString(msg));
            } catch (Exception e) {
                return;
            }
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(wsMessage);
                        session.close(CloseStatus.NORMAL);
                    } catch (IOException e) {
                        // ignore
                    }
                }
            }
            roomSessions.remove(roomId);
        }
        
        Set<WebSocketSession> pSessions = pendingSessions.get(roomId);
        if (pSessions != null) {
            ObjectNode msg = objectMapper.createObjectNode();
            msg.put("type", "room_deleted");
            msg.put("roomId", roomId);
            TextMessage wsMessage;
            try {
                wsMessage = new TextMessage(objectMapper.writeValueAsString(msg));
            } catch (Exception e) {
                return;
            }
            for (WebSocketSession session : pSessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(wsMessage);
                        session.close(CloseStatus.NORMAL);
                    } catch (IOException e) {
                        // ignore
                    }
                }
            }
            pendingSessions.remove(roomId);
        }
    }

    private void handleRemoveUser(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.removeUserFromRoom(roomDbId, targetUserId, adminId);

            Set<WebSocketSession> sessions = roomSessions.get(roomId);
            WebSocketSession targetSession = null;
            if (sessions != null) {
                for (WebSocketSession s : sessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        targetSession = s;
                        break;
                    }
                }
            }

            if (targetSession != null && targetSession.isOpen()) {
                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "user_removed");
                response.put("roomId", roomId);
                targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                targetSession.close(CloseStatus.NORMAL);
                System.out.println("User " + targetUserId + " kicked/removed from Room: " + roomId);
            }

            broadcastCollaboratorList(roomId);

        } catch (Exception e) {
            System.err.println("Error in handleRemoveUser: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleToggleWritePermission(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("userId")) return;
        String targetUserId = data.get("userId").asText();
        
        String role = "WRITE";
        if (data.has("role")) {
            role = data.get("role").asText();
        } else if (data.has("canWrite")) {
            role = data.get("canWrite").asBoolean() ? "WRITE" : "READ_ONLY";
        }

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.updateUserRole(roomDbId, targetUserId, role, adminId);

            // Find the target collaborator session to update their in-memory permission and notify them
            Set<WebSocketSession> sessions = roomSessions.get(roomId);
            if (sessions != null) {
                for (WebSocketSession s : sessions) {
                    if (targetUserId.equals(s.getAttributes().get("userId"))) {
                        @SuppressWarnings("unchecked")
                        Map<String, String> roles = (Map<String, String>) s.getAttributes()
                                .computeIfAbsent("roles", k -> new java.util.concurrent.ConcurrentHashMap<>());
                        roles.put(roomId, role);

                        @SuppressWarnings("unchecked")
                        Map<String, Boolean> permissions = (Map<String, Boolean>) s.getAttributes()
                                .computeIfAbsent("permissions", k -> new java.util.concurrent.ConcurrentHashMap<>());
                        permissions.put(roomId, "WRITE".equalsIgnoreCase(role));

                        ObjectNode response = objectMapper.createObjectNode();
                        response.put("type", "write_permission_changed");
                        response.put("roomId", roomId);
                        response.put("role", role);
                        response.put("canWrite", "WRITE".equalsIgnoreCase(role));
                        s.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                        break;
                    }
                }
            }

            broadcastCollaboratorList(roomId);

        } catch (Exception e) {
            System.err.println("Error in handleToggleWritePermission: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleToggleRoomLock(WebSocketSession adminSession, String roomId, JsonNode data) throws IOException {
        String adminId = (String) adminSession.getAttributes().get("userId");
        if (!data.has("isLocked")) return;
        boolean isLocked = data.get("isLocked").asBoolean();

        try {
            Integer roomDbId = Integer.parseInt(roomId);
            roomService.updateRoomLockStatus(roomDbId, isLocked, adminId);

            // Update in-memory state
            RoomState roomState = activeRooms.get(roomId);
            if (roomState != null) {
                roomState.setLocked(isLocked);
            }

            // Broadcast lock state change to everyone in the room
            ObjectNode response = objectMapper.createObjectNode();
            response.put("type", "room_lock_changed");
            response.put("roomId", roomId);
            response.put("isLocked", isLocked);
            broadcastToRoom(roomId, response);

        } catch (Exception e) {
            System.err.println("Error in handleToggleRoomLock: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleClearCanvas(WebSocketSession session, String roomId) {
        String userId = (String) session.getAttributes().get("userId");
        if (!isUserAdmin(roomId, userId)) {
            System.out.println("Blocked unauthorized clear canvas request from user " + userId);
            return;
        }

        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        synchronized (roomState) {
            roomState.saveState();
            roomState.getShapes().clear();
        }

        // Broadcast clear event
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "clear");
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleLaserMove(WebSocketSession session, String roomId, JsonNode data) {
        String userId = (String) session.getAttributes().get("userId");
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        double x = data.has("x") ? data.get("x").asDouble() : 0.0;
        double y = data.has("y") ? data.get("y").asDouble() : 0.0;
        String userName = data.has("userName") ? data.get("userName").asText() : "User";

        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "laser_move");
        broadcast.put("userId", userId);
        broadcast.put("userName", userName);
        broadcast.put("x", x);
        broadcast.put("y", y);
        broadcast.put("roomId", roomId);

        broadcastToOtherSessions(session, roomId, broadcast);
    }

    private void handleLaserStop(WebSocketSession session, String roomId, JsonNode data) {
        String userId = (String) session.getAttributes().get("userId");
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "laser_stop");
        broadcast.put("userId", userId);
        broadcast.put("roomId", roomId);

        broadcastToOtherSessions(session, roomId, broadcast);
    }

    private void broadcastToOtherSessions(WebSocketSession sender, String roomId, JsonNode message) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        String payload;
        try {
            payload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            return;
        }

        TextMessage wsMessage = new TextMessage(payload);
        for (WebSocketSession session : sessions) {
            if (session.isOpen() && !session.getId().equals(sender.getId())) {
                try {
                    session.sendMessage(wsMessage);
                } catch (IOException e) {
                    // ignore
                }
            }
        }
    }
}
