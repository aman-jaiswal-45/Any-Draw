package com.anydraw.websocket;

import lombok.Data;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;

@Data
public class RoomState {
    private boolean isLocked = false;
    private List<StoredShape> shapes = new ArrayList<>();
    private Deque<List<StoredShape>> undoStack = new LinkedList<>();
    private Deque<List<StoredShape>> redoStack = new LinkedList<>();

    // Keep undo/redo size within reason to optimize memory
    private static final int MAX_STACK_SIZE = 100;

    public void saveState() {
        // Deep copy list of shapes
        List<StoredShape> snapshot = new ArrayList<>();
        for (StoredShape s : shapes) {
            snapshot.add(new StoredShape(s.getId(), s.getShape()));
        }
        
        undoStack.push(snapshot);
        if (undoStack.size() > MAX_STACK_SIZE) {
            undoStack.removeLast();
        }
        
        // Once a new drawing action is taken, clear redoStack
        redoStack.clear();
    }
}
