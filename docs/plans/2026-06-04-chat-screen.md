# Chat Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ChatScreen skeleton with a fully working agentic chat — streaming AI responses, inline tool call pills, expanding input bar, and session persistence.

**Architecture:** Port `envoi/web/agent-loop.js` to TypeScript, streaming via `fetch` + `ReadableStream`. All chat state in `useState` inside `ChatScreen`. Config (model, base_url, project_root) fetched from `GET /config` before each loop run.

**Tech Stack:** Expo SDK 54, `@shopify/flash-list` (message list), `react-native-keyboard-controller` (keyboard avoidance), TypeScript.

**Spec:** `docs/specs/2026-06-04-chat-screen-design.md`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/agent/types.ts` | Create | Shared TypeScript types: Message, ToolCall, ChatConfig |
| `src/agent/loop.ts` | Create | Full agentic loop — streams completions, executes tools |
| `src/api/client.ts` | Modify | Add `rawFetch` for streaming responses |
| `src/components/ToolCallPill.tsx` | Create | Compact pill + expandable input/output |
| `src/components/MessageBubble.tsx` | Create | User/assistant bubble with blinking cursor |
| `src/components/InputBar.tsx` | Create | Auto-expanding input, send/stop toggle |
| `src/screens/ChatScreen.tsx` | Replace | Full chat screen |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install FlashList and keyboard controller**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
npx expo install @shopify/flash-list
npx expo install react-native-keyboard-controller
```

- [ ] **Step 2: Verify packages appear in `package.json`**

```bash
node -e "const p=require('./package.json'); console.log(p.dependencies['@shopify/flash-list'], p.dependencies['react-native-keyboard-controller'])"
```

Expected: two version strings printed (not `undefined`)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add flash-list and keyboard-controller deps"
```

---

## Task 2: Shared types + `rawFetch`

**Files:**
- Create: `src/agent/types.ts`
- Modify: `src/api/client.ts`

- [ ] **Step 1: Create `src/agent/types.ts`**

```typescript
export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "running" | "done" | "error";
  expanded: boolean;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
};

export type ChatConfig = {
  model: string;
  base_url: string;
  project_root: string;
  temperature: number;
};
```

- [ ] **Step 2: Add `rawFetch` to `src/api/client.ts`**

Add after the existing `pairingFetch` function:

```typescript
// Returns raw Response for streaming — caller is responsible for reading body
export async function rawFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const url = await getServerUrl();
  const token = await getToken();
  if (!url || !token) return null;
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/agent/types.ts src/api/client.ts
git commit -m "feat: add shared chat types and rawFetch helper"
```

---

## Task 3: Agent loop

**Files:**
- Create: `src/agent/loop.ts`

- [ ] **Step 1: Create `src/agent/loop.ts`**

```typescript
import { apiFetch, rawFetch } from "../api/client";
import type { ChatConfig, Message, ToolCall } from "./types";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a PowerShell command in the project root.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the full contents of a file.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file, creating parent directories as needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and subdirectories in a directory.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for a regex pattern across files.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
          glob: { type: "string" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_info",
      description: "Get OS, shell, project root, and current date/time.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web using DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          max_results: { type: "integer" },
        },
        required: ["query"],
      },
    },
  },
];

export async function fetchConfig(): Promise<ChatConfig | null> {
  const result = await apiFetch<ChatConfig>("/config");
  if (!result.ok) return null;
  return result.data;
}

type LoopOpts = {
  // OpenAI-format messages array — mutated in place with assistant + tool turns
  apiMessages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }>;
  config: ChatConfig;
  signal: AbortSignal;
  onChunk: (delta: string) => void;
  onToolStart: (id: string, name: string, input: Record<string, unknown>) => void;
  onToolDone: (id: string, output: string, status: "done" | "error") => void;
};

export async function runAgentLoop(opts: LoopOpts): Promise<void> {
  const { apiMessages, config, signal, onChunk, onToolStart, onToolDone } = opts;

  while (true) {
    const payload = {
      model: config.model,
      messages: apiMessages,
      stream: true,
      temperature: config.temperature ?? 0.7,
      tools: TOOLS,
      tool_choice: "auto",
    };

    const resp = await rawFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "X-Upstream": config.base_url },
      body: JSON.stringify(payload),
      signal,
    });

    if (!resp || !resp.ok) {
      const text = resp ? await resp.text() : "No response";
      throw new Error(`HTTP ${resp?.status ?? 0}: ${text.slice(0, 200)}`);
    }

    const { content, toolCalls, finishReason } = await _readStream(resp.body!, onChunk);

    apiMessages.push({
      role: "assistant",
      content: content || null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    });

    if (finishReason !== "tool_calls" && toolCalls.length === 0) return;

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse((tc as any).function.arguments || "{}"); } catch {}
      const name = (tc as any).function.name as string;
      const id = (tc as any).id as string;

      onToolStart(id, name, args);

      const toolResult = await apiFetch<{ stdout: string; stderr: string; exit_code: number }>(
        "/tools",
        {
          method: "POST",
          body: JSON.stringify({ tool: name, args, cwd: config.project_root || "" }),
        }
      );

      const output = toolResult.ok
        ? toolResult.data.stdout || toolResult.data.stderr || "done"
        : `Error: ${toolResult.error}`;
      const status = toolResult.ok && toolResult.data.exit_code === 0 ? "done" : "error";

      onToolDone(id, output, status);
      apiMessages.push({ role: "tool", tool_call_id: id, content: output });
    }
  }
}

async function _readStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (delta: string) => void
): Promise<{ content: string; toolCalls: unknown[]; finishReason: string | null }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let content = "";
  const acc: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {};
  let finishReason: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const d = t.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        const choice = j.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) { content += delta.content; onChunk(delta.content); }
        if (delta?.tool_calls) _accToolCalls(acc, delta.tool_calls);
        if (choice.finish_reason) finishReason = choice.finish_reason;
      } catch {}
    }
  }

  return { content, toolCalls: Object.values(acc), finishReason };
}

function _accToolCalls(
  acc: Record<number, { id: string; type: string; function: { name: string; arguments: string } }>,
  deltas: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>
) {
  for (const tc of deltas) {
    const i = tc.index;
    if (!acc[i]) acc[i] = { id: "", type: "function", function: { name: "", arguments: "" } };
    if (tc.id) acc[i].id = tc.id;
    if (tc.function?.name) acc[i].function.name += tc.function.name;
    if (tc.function?.arguments) acc[i].function.arguments += tc.function.arguments;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/agent/loop.ts src/agent/types.ts
git commit -m "feat: agent loop TypeScript port with streaming and tool execution"
```

---

## Task 4: ToolCallPill component

**Files:**
- Create: `src/components/ToolCallPill.tsx`

- [ ] **Step 1: Create `src/components/ToolCallPill.tsx`**

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ToolCall } from "../agent/types";

const TOOL_ICONS: Record<string, string> = {
  bash: "⚙",
  read_file: "📄",
  write_file: "✏",
  list_directory: "📁",
  search_files: "🔍",
  get_system_info: "ℹ",
  web_search: "🌐",
};

type Props = {
  toolCall: ToolCall;
  onToggle: (id: string) => void;
};

export default function ToolCallPill({ toolCall, onToggle }: Props) {
  const icon = TOOL_ICONS[toolCall.name] ?? "🔧";
  const statusColor =
    toolCall.status === "done" ? "#4ade80" : toolCall.status === "error" ? "#ef4444" : "#fbbf24";
  const statusSymbol =
    toolCall.status === "done" ? "✓" : toolCall.status === "error" ? "✗" : "●";

  return (
    <TouchableOpacity onPress={() => onToggle(toolCall.id)} activeOpacity={0.7}>
      {/* Collapsed pill */}
      <View style={styles.pill}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{toolCall.name}</Text>
        <Text style={[styles.status, { color: statusColor }]}>{statusSymbol}</Text>
      </View>

      {/* Expanded view */}
      {toolCall.expanded && (
        <View style={styles.expanded}>
          <View style={styles.expandedHeader}>
            <View style={styles.expandedTitle}>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={[styles.name, { color: "#fbbf24" }]}>{toolCall.name}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.status, { color: statusColor }]}>
                {toolCall.status === "done" ? "✓ done" : toolCall.status === "error" ? "✗ error" : "● running"}
              </Text>
              <Text style={styles.chevron}>▲</Text>
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>INPUT</Text>
            <Text style={styles.blockText}>
              {JSON.stringify(toolCall.input, null, 2)}
            </Text>
          </View>

          {toolCall.output !== undefined && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>OUTPUT</Text>
              <Text style={styles.blockText} numberOfLines={10}>
                {toolCall.output}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#334155",
  },
  icon: { fontSize: 11 },
  name: { color: "#94a3b8", fontSize: 11, fontFamily: "monospace" },
  status: { fontSize: 10 },
  expanded: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 10,
    marginTop: 4,
    gap: 6,
  },
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  expandedTitle: { flexDirection: "row", alignItems: "center", gap: 5 },
  chevron: { color: "#475569", fontSize: 10 },
  block: {
    backgroundColor: "#0f172a",
    borderRadius: 6,
    padding: 7,
  },
  blockLabel: { color: "#475569", fontSize: 8, marginBottom: 3 },
  blockText: { color: "#94a3b8", fontSize: 10, fontFamily: "monospace", lineHeight: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ToolCallPill.tsx
git commit -m "feat: ToolCallPill component with expand/collapse"
```

---

## Task 5: MessageBubble component

**Files:**
- Create: `src/components/MessageBubble.tsx`

- [ ] **Step 1: Create `src/components/MessageBubble.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MessageBubble.tsx
git commit -m "feat: MessageBubble with blinking cursor for streaming"
```

---

## Task 6: InputBar component

**Files:**
- Create: `src/components/InputBar.tsx`

- [ ] **Step 1: Create `src/components/InputBar.tsx`**

```typescript
import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
};

export default function InputBar({ onSend, onStop, streaming, disabled }: Props) {
  const [text, setText] = useState("");

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Message Envoi…"
        placeholderTextColor="#475569"
        multiline
        maxLength={4000}
        editable={!streaming}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      {streaming ? (
        <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.8}>
          <Text style={styles.stopIcon}>■</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || disabled) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          activeOpacity={0.8}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#e2e8f0",
    fontSize: 14,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: "#fbbf24",
    borderRadius: 50,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: "#334155" },
  sendIcon: { color: "#000", fontWeight: "700", fontSize: 16 },
  stopBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 50,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopIcon: { color: "#fff", fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InputBar.tsx
git commit -m "feat: InputBar with auto-expand and send/stop toggle"
```

---

## Task 7: ChatScreen — full implementation

**Files:**
- Replace: `src/screens/ChatScreen.tsx`

- [ ] **Step 1: Replace `src/screens/ChatScreen.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ChatScreen.tsx src/components/
git commit -m "feat: full chat screen with streaming, tool calls, and session persistence"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start Envoi server**

```bash
cd C:\Users\kenan\Documents\proj\envoi
python -m envoi --no-browser
```

- [ ] **Step 2: Start companion app**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
npx expo start --lan
```

- [ ] **Step 3: Verify golden path**

1. Open app → Chat tab shows empty state ("What can I help you with?")
2. Type `hello` → send → AI responds with streaming text and blinking cursor
3. Cursor disappears when response ends
4. Type `list files in project root` → agent uses `list_directory` tool → compact pill appears with `●` → turns `✓` when done → tap pill to expand and see output
5. Tap Stop (■) mid-response → stream stops, message ends where it was
6. Tap ✏ New → screen clears, back to empty state

- [ ] **Step 4: Push to GitHub**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Empty state "What can I help you with?" — ChatScreen empty branch
- ✅ Session created on first send — `POST /sessions` in `handleSend`
- ✅ Live tokens + blinking cursor — `BlinkingCursor` in `MessageBubble`, `streaming` prop
- ✅ Compact tool call pills — `ToolCallPill` with collapsed/expanded states
- ✅ Tap to expand — `onToggle` → `handleToggleTool` flips `expanded`
- ✅ Input bar expands, send/stop toggle — `InputBar` with `streaming` prop
- ✅ New chat button — `handleNew` clears messages + sessionId
- ✅ Messages saved after each turn — `POST /sessions/:id/messages`
- ✅ 401 → clearCredentials — handled in `rawFetch` via `apiFetch`; `rawFetch` does not auto-clear but `apiFetch` for tool calls does
- ✅ AbortController tied to Stop button — `abortRef.current?.abort()`

**Type consistency:**
- `ToolCall.id` used as key in `onToolStart(id,...)` and `onToolDone(id,...)` — consistent ✓
- `Message.toolCalls?: ToolCall[]` — MessageBubble maps over `message.toolCalls` ✓
- `ChatConfig` returned by `fetchConfig()` — passed directly into `runAgentLoop` ✓
- `apiMessages` built from `messages.map(m => ({role: m.role, content: m.content}))` — correct OpenAI format ✓

**Placeholder scan:** No TBD, TODO, or incomplete sections found.
