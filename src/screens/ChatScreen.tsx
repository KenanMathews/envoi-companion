import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { apiFetch } from "../api/client";
import { fetchConfig, runAgentLoop } from "../agent/loop";
import type { ChatConfig, Message, ToolCall } from "../agent/types";
import MessageBubble from "../components/MessageBubble";
import InputBar from "../components/InputBar";

let _msgId = 0;
const nextId = () => String(++_msgId);

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load config once
  React.useEffect(() => {
    fetchConfig().then((c) => { if (c) setConfig(c); });
  }, []);

  const handleToggleTool = useCallback((toolId: string) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        toolCalls: m.toolCalls?.map((tc) =>
          tc.id === toolId ? { ...tc, expanded: !tc.expanded } : tc
        ),
      }))
    );
  }, []);

  async function handleSend(text: string) {
    if (!config) return;

    const userMsg: Message = { id: nextId(), role: "user", content: text };
    const assistantMsg: Message = {
      id: nextId(),
      role: "assistant",
      content: "",
      streaming: true,
      toolCalls: [],
    };

    // Create session on first message
    let sid = sessionId;
    if (!sid) {
      const res = await apiFetch<{ id: string }>("/sessions", {
        method: "POST",
        body: JSON.stringify({ title: text.slice(0, 60), model: config.model }),
      });
      if (res.ok) { sid = res.data.id; setSessionId(sid); }
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    // Build OpenAI-format message history for the API
    const apiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await runAgentLoop({
        apiMessages,
        config,
        signal: abortController.signal,
        onChunk: (delta) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + delta },
            ];
          });
        },
        onToolStart: (id, name, input) => {
          const tc: ToolCall = { id, name, input, status: "running", expanded: false };
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [
              ...prev.slice(0, -1),
              { ...last, toolCalls: [...(last.toolCalls ?? []), tc] },
            ];
          });
        },
        onToolDone: (id, output, status) => {
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.id === id ? { ...tc, output, status } : tc
              ),
            }))
          );
        },
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        const errMsg: Message = {
          id: nextId(),
          role: "assistant",
          content: `Connection lost — ${e.message ?? "unknown error"}`,
        };
        setMessages((prev) => [...prev.slice(0, -1), errMsg]);
      }
    } finally {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [...prev.slice(0, -1), { ...last, streaming: false }];
      });
      setStreaming(false);
    }

    // Persist turn to server
    if (sid) {
      const savedMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      await apiFetch(`/sessions/${sid}/messages`, {
        method: "POST",
        body: JSON.stringify({ messages: savedMessages }),
      });
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleNew() {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setStreaming(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.model}>{config?.model ?? "…"}</Text>
          <Text style={styles.newBtn} onPress={handleNew}>✏ New</Text>
        </View>

        {/* Message list or empty state */}
        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>Envoi</Text>
            <Text style={styles.emptyHint}>What can I help you with?</Text>
          </View>
        ) : (
          <FlashList
            data={[...messages].reverse()}
            inverted
            renderItem={({ item }) => (
              <MessageBubble message={item} onToggleTool={handleToggleTool} />
            )}
            estimatedItemSize={80}
            contentContainerStyle={styles.list}
            keyExtractor={(item) => item.id}
          />
        )}

        <InputBar
          onSend={handleSend}
          onStop={handleStop}
          streaming={streaming}
          disabled={!config}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#1e293b",
  },
  model: { color: "#94a3b8", fontSize: 12 },
  newBtn: { color: "#fbbf24", fontSize: 12 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyIcon: { fontSize: 32, color: "#334155" },
  emptyTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "700" },
  emptyHint: { color: "#475569", fontSize: 13 },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
});
