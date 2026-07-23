package com.codecollab.server.controller;

import com.codecollab.server.Element.EditorMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.ResponseEntity;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

@RestController
@CrossOrigin(origins="*")
public class EditorController {

    private static class RoomData {
        List<Integer> content;
        long lastUpdated;

        RoomData(List<Integer> content) {
            this.content = content;
            this.lastUpdated = System.currentTimeMillis();
        }
    }

    private final ConcurrentHashMap<String, RoomData> roomMemory = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Set<String>> roomSessions = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, String> sessionRoomMap = new ConcurrentHashMap<>();

    public static int getRoomUserCount(String roomId) {
        Set<String> sessions = roomSessions.get(roomId);
        return sessions != null ? sessions.size() : 0;
    }

    @MessageMapping("/code/{roomId}")
    @SendTo("/topic/room/{roomId}")
    public EditorMessage broadcastCode(@DestinationVariable String roomId, EditorMessage message){
        roomMemory.put(roomId, new RoomData(message.getContent()));
        return message;
    }

    @GetMapping("/api/room/{roomId}")
    public EditorMessage getInitialState(@PathVariable String roomId){
        RoomData roomData = roomMemory.get(roomId);
        List<Integer> currentCode = roomData != null ? roomData.content : null;
        return new EditorMessage(currentCode);
    }

    @MessageMapping("/cursor/{roomId}")
    @SendTo("/topic/cursor/{roomId}")
    public Object broadcastCursor(@DestinationVariable String roomId, Object message){
        return message;
    }

    @EventListener
    public void handleSessionSubscribeEvent(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = headerAccessor.getDestination();
        if (destination != null && destination.startsWith("/topic/room/")) {
            String roomId = destination.substring("/topic/room/".length());
            String sessionId = headerAccessor.getSessionId();
            
            sessionRoomMap.put(sessionId, roomId);
            roomSessions.computeIfAbsent(roomId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        }
    }

    @EventListener
    public void handleSessionDisconnectEvent(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String roomId = sessionRoomMap.remove(sessionId);
        if (roomId != null) {
            Set<String> sessions = roomSessions.get(roomId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    roomSessions.remove(roomId);
                }
            }
        }
    }

    @GetMapping("/api/room/{roomId}/users")
    public int getRoomUsers(@PathVariable String roomId) {
        return getRoomUserCount(roomId);
    }

    @GetMapping("/api/room/{roomId}/check-join")
    public ResponseEntity<?> checkJoin(@PathVariable String roomId) {
        if (getRoomUserCount(roomId) >= 3) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "Room is full. Maximum 3 users allowed."));
        }
        return ResponseEntity.ok(Collections.singletonMap("success", true));
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupInactiveRooms() {
        long now = System.currentTimeMillis();
        long twentyFourHours = 24 * 60 * 60 * 1000L;
        
        for (Map.Entry<String, RoomData> entry : roomMemory.entrySet()) {
            String roomId = entry.getKey();
            if (getRoomUserCount(roomId) == 0 && (now - entry.getValue().lastUpdated > twentyFourHours)) {
                roomMemory.remove(roomId);
            }
        }
    }

}
