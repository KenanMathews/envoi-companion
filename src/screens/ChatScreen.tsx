import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  FlatList,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { C } from "../theme";
import { apiFetch } from "../api/client";
import { fetchConfig, runAgentLoop } from "../agent/loop";
import type { ChatConfig, Message, ToolCall } from "../agent/types";
import MessageBubble from "../components/MessageBubble";
import InputBar from "../components/InputBar";
import type { MainTabParamList } from "../navigation/index";

let _msgId = 0;
const nextId = () => String(++_msgId);

type ChatRoute = RouteProp<MainTabParamList, "Chat">;

export default function ChatScreen() {
  const route = useRoute<ChatRoute>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<string>("");

  // Load config once
  useEffect(() => {
    fetchConfig().then((c) => { if (c) setConfig(c); });
  }, []);

  // Load session when navigated from History
  useEffect(() => {
    const incomingId = route.params?.sessionId;
    if (!incomingId || incomingId === sessionId) return;
    abortRef.current?.abort();
    setStreaming(false);
    setSessionId(incomingId);
    setMessages([]);
    apiFetch<Array<{ role: string; content: string }>>(`/sessions/${incomingId}`).then((res) => {
      if (!res.ok) return;
      const loaded: Message[] = res.data
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: nextId(),
          role: m.role as "user" | "assistant",
          content: m.content ?? "",
        }));
      setMessages(loaded);
    });
  }, [route.params?.sessionId]);

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

  const handleSend = useCallback(async (text: string) => {
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
          responseRef.current += delta;
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

    // Persist full turn to server
    if (sid) {
      const savedMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
        ...(responseRef.current ? [{ role: "assistant", content: responseRef.current }] : []),
      ];
      responseRef.current = "";
      await apiFetch(`/sessions/${sid}/messages`, {
        method: "POST",
        body: JSON.stringify({ messages: savedMessages }),
      });
    }
  }, [config, messages, sessionId]);

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
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
          <FlatList
            data={reversedMessages}
            inverted
            renderItem={({ item }) => (
              <MessageBubble message={item} onToggleTool={handleToggleTool} />
            )}
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
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    backgroundColor: C.panel,
  },
  model: { color: C.soft, fontSize: 12 },
  newBtn: { color: C.accent, fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIcon: { fontSize: 32, color: C.line },
  emptyTitle: { color: C.ink, fontSize: 18, fontWeight: "700" },
  emptyHint: { color: C.faint, fontSize: 13 },
  list: { paddingHorizontal: 12, paddingVertical: 12 },
});
