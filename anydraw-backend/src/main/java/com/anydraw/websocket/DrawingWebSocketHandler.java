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
        if (query != null) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("token=")) {
                    token = param.substring(6);
                    break;
                }
            }
        }

        if (token == null || !jwtService.isTokenValid(token)) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String userId = jwtService.extractUserId(token);
        session.getAttributes().put("userId", userId);
        session.getAttributes().put("rooms", new CopyOnWriteArraySet<String>());
        System.out.println("WebSocket connected for User ID: " + userId);
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
            default:
                System.out.println("Unknown WS action type: " + type);
        }
    }

    private void handleJoinRoom(WebSocketSession session, String roomId) throws IOException {
        @SuppressWarnings("unchecked")
        Set<String> sessionRooms = (Set<String>) session.getAttributes().get("rooms");
        sessionRooms.add(roomId);

        roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);

        // Load or initialize room state
        RoomState roomState = activeRooms.get(roomId);
        if (roomState == null) {
            roomState = new RoomState();
            try {
                Integer roomDbId = Integer.parseInt(roomId);
                List<Chat> existingChats = chatService.getChatsByRoomId(roomDbId);
                for (Chat entry : existingChats) {
                    if (entry.getMessage() != null) {
                        try {
                            JsonNode parsed = objectMapper.readTree(entry.getMessage());
                            if (parsed.has("shape")) {
                                roomState.getShapes().add(new StoredShape(String.valueOf(entry.getId()), parsed.get("shape")));
                            }
                        } catch (Exception e) {
                            // Skip corrupted logs
                        }
                    }
                }
            } catch (NumberFormatException e) {
                System.err.println("Invalid Room ID layout: " + roomId);
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
}
