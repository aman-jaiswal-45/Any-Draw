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

        switch (type) {
            case "join_room":
                handleJoinRoom(session, roomId);
                break;
            case "leave_room":
                handleLeaveRoom(session, roomId);
                break;
            case "chat":
                handleCreateShape(roomId, data);
                break;
            case "update":
                handleUpdateShape(roomId, data);
                break;
            case "delete":
                handleDeleteShape(roomId, data);
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

            // Load or initialize room state
            RoomState roomState = activeRooms.get(roomId);
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

            // If this user is the room creator, load all pending requests from database and send them
            com.anydraw.model.Room roomObj = roomService.getRoomById(roomDbId).orElse(null);
            if (roomObj != null && roomObj.getAdmin().getId().equals(userId)) {
                List<com.anydraw.model.PendingRequest> pending = roomService.getPendingRequestsForRoom(roomDbId);
                if (!pending.isEmpty()) {
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
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(pendingResponse)));
                }
            }

            // Broadcast collaborator list update to the room
            broadcastCollaboratorList(roomId);
        } else {
            // Record request in DB
            String joinStatus = roomService.checkAndJoinRoom(roomDbId, userId);

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

    private void handleCreateShape(String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String tempId = data.has("tempId") ? data.get("tempId").asText() : null;
        JsonNode shape = data.get("shape");

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

    private void handleUpdateShape(String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String shapeId = data.get("id").asText();
        JsonNode shape = data.get("shape");

        synchronized (roomState) {
            roomState.saveState();
            for (StoredShape s : roomState.getShapes()) {
                if (s.getId().equals(shapeId)) {
                    s.setShape(shape);
                    break;
                }
            }
        }

        // Broadcast shape update
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "update");
        broadcast.put("id", shapeId);
        broadcast.set("shape", shape);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleDeleteShape(String roomId, JsonNode data) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        String shapeId = data.get("id").asText();

        synchronized (roomState) {
            roomState.saveState();
            roomState.getShapes().removeIf(s -> s.getId().equals(shapeId));
        }

        // Broadcast deletion
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "delete");
        broadcast.put("id", shapeId);
        broadcast.put("roomId", roomId);

        broadcastToRoom(roomId, broadcast);
    }

    private void handleUndo(String roomId) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        synchronized (roomState) {
            if (roomState.getUndoStack().isEmpty()) return;
            
            // Push current state to redo
            List<StoredShape> currentSnapshot = new ArrayList<>();
            for (StoredShape s : roomState.getShapes()) {
                currentSnapshot.add(new StoredShape(s.getId(), s.getShape()));
            }
            roomState.getRedoStack().push(currentSnapshot);

            // Pop previous state
            roomState.setShapes(roomState.getUndoStack().pop());
        }

        // Broadcast undo shapes array
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "undo");
        broadcast.put("roomId", roomId);
        ArrayNode shapesNode = broadcast.putArray("shapes");
        synchronized (roomState) {
            for (StoredShape shape : roomState.getShapes()) {
                ObjectNode shapeNode = shapesNode.addObject();
                shapeNode.put("id", shape.getId());
                shapeNode.set("shape", shape.getShape());
            }
        }

        broadcastToRoom(roomId, broadcast);
    }

    private void handleRedo(String roomId) {
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) return;

        synchronized (roomState) {
            if (roomState.getRedoStack().isEmpty()) return;

            // Push current state to undo
            List<StoredShape> currentSnapshot = new ArrayList<>();
            for (StoredShape s : roomState.getShapes()) {
                currentSnapshot.add(new StoredShape(s.getId(), s.getShape()));
            }
            roomState.getUndoStack().push(currentSnapshot);

            // Pop next state
            roomState.setShapes(roomState.getRedoStack().pop());
        }

        // Broadcast redo shapes array
        ObjectNode broadcast = objectMapper.createObjectNode();
        broadcast.put("type", "redo");
        broadcast.put("roomId", roomId);
        ArrayNode shapesNode = broadcast.putArray("shapes");
        synchronized (roomState) {
            for (StoredShape shape : roomState.getShapes()) {
                ObjectNode shapeNode = shapesNode.addObject();
                shapeNode.put("id", shape.getId());
                shapeNode.set("shape", shape.getShape());
            }
        }

        broadcastToRoom(roomId, broadcast);
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

                ObjectNode response = objectMapper.createObjectNode();
                response.put("type", "join_approved");
                response.put("roomId", roomId);

                RoomState roomState = activeRooms.get(roomId);
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

    private void broadcastCollaboratorList(String roomId) {
        Set<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

        List<Map<String, String>> usersList = new ArrayList<>();
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                String uId = (String) s.getAttributes().get("userId");
                if (uId != null) {
                    com.anydraw.model.User user = userService.getUserById(uId).orElse(null);
                    if (user != null) {
                        Map<String, String> uMap = new HashMap<>();
                        uMap.put("userId", user.getId());
                        uMap.put("userName", user.getName());
                        uMap.put("userEmail", user.getEmail());
                        usersList.add(uMap);
                    }
                }
            }
        }

        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "collaborators_list");
        msg.put("roomId", roomId);
        ArrayNode collaboratorsNode = msg.putArray("collaborators");
        for (Map<String, String> u : usersList) {
            ObjectNode uNode = collaboratorsNode.addObject();
            uNode.put("userId", u.get("userId"));
            uNode.put("userName", u.get("userName"));
            uNode.put("userEmail", u.get("userEmail"));
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
}
