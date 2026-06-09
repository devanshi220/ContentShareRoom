package com.codecollab.server.Element;

public class EditorMessage {
    private String content;

    public EditorMessage(){};

    public EditorMessage(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
