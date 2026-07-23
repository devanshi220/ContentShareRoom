package com.codecollab.server.Element;

import java.util.List;

public class EditorMessage {
    private List<Integer> content;

    public EditorMessage(){};

    public EditorMessage(List<Integer> content) {
        this.content = content;
    }

    public List<Integer> getContent() {
        return content;
    }

    public void setContent(List<Integer> content) {
        this.content = content;
    }
}
