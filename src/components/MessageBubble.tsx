import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import type { Message, ToolCall } from "../agent/types";
import ToolCallPill from "./ToolCallPill";

type Props = {
  message: Message;
  onToggleTool: (id: string) => void;
};

function BlinkingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.Text style={[styles.cursor, { opacity }]}>|</Animated.Text>;
}

export default function MessageBubble({ message, onToggleTool }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      {/* Tool call pills rendered above the text */}
      {message.toolCalls?.map((tc: ToolCall) => (
        <ToolCallPill key={tc.id} toolCall={tc} onToggle={onToggleTool} />
      ))}

      {/* Assistant text bubble — only render if there's content */}
      {(message.content.length > 0 || message.streaming) && (
        <View style={styles.assistantBubble}>
          <Text style={styles.assistantText}>
            {message.content}
            {message.streaming && <BlinkingCursor />}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: { alignItems: "flex-end", marginBottom: 8 },
  assistantRow: { alignItems: "flex-start", marginBottom: 8, gap: 6 },
  userBubble: {
    backgroundColor: "rgba(251,191,36,0.15)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    borderRadius: 14,
    borderBottomRightRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: "80%",
  },
  userText: { color: "#e2e8f0", fontSize: 14, lineHeight: 20 },
  assistantBubble: {
    backgroundColor: "#1e293b",
    borderRadius: 2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: "88%",
  },
  assistantText: { color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  cursor: { color: "#fbbf24", fontWeight: "700" },
});
