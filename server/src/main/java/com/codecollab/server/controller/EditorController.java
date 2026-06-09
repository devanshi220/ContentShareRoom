package com.codecollab.server.controller;

import com.codecollab.server.Element.EditorMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class EditorController {

    @MessageMapping("/code/{roomId}")
    @SendTo("/topic/room/{roomId}")

    public EditorMessage broadcastCode(@DestinationVariable String roomId, EditorMessage message){
        return message;
    }
}
