# Chat Screen Design

## Overview

Implement the core chat experience for the Envoi Companion app — a full agentic chat screen with streaming AI responses, inline tool call pills, and an expanding input bar. This is sub-project 1 of 3; History and full session persistence come after.

---

## Scope

**In scope:**
- `ChatScreen` replacing the skeleton
- Streaming AI responses via `fetch` + `ReadableStream` (SSE)
- Full agent loop with tool calls (port of `agent-loop.js`)
- Compact tool call pills (tap to expand input/output)
- Expanding input bar with send/stop toggle
- Empty state ("What can I help you with?")
- New chat button (clears messages, starts fresh session)
- Session created on first send, messages saved after each turn

**Out of scope:**
- History screen / session list (sub-project 2)
- Markdown rendering (bold, code blocks) — plain text only for now
- File attachments
- MCP tools

---

## Architecture

### New files

| File | Responsibility |
|---|---|
| `src/agent/sse.ts` | Parse raw SSE bytes from `ReadableStream` into typed delta objects |
| `src/agent/loop.ts` | Agentic loop — streams completions, executes tool calls, calls `onChunk`/`onToolCall` |
| `src/components/MessageBubble.tsx` | User and assistant message bubbles; shows blinking cursor while `streaming: true` |
| `src/components/ToolCallPill.tsx` | Compact pill with tool name + status; tappable to expand input/output |
| `src/components/InputBar.tsx` | Auto-expanding `TextInput` (max 4 lines), send/stop button |
| `src/screens/ChatScreen.tsx` | Full implementation replacing skeleton |

### Dependencies to install
- `@shopify/flash-list` — performant inverted list for messages
- `react-native-keyboard-controller` — reliable keyboard avoidance

---

## State Shape

All state lives in `ChatScreen` via `useState`:

```typescript
type ToolCall = {
  id: string;
  name: string;
  input: Record<string, any>;
  output?: string;
  status: "running" | "done" | "error";
  expanded: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
};
```

---

## SSE Parser (`src/agent/sse.ts`)

Reads from `response.body.getReader()`, splits on `\n\n`, parses `data:` lines, and yields typed events:

```typescript
type SSEEvent =
  | { type: "content_delta"; delta: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_args"; id: string; args_delta: string }
  | { type: "done" };
```

Handles the OpenAI streaming format: `choices[0].delta.content` for text, `choices[0].delta.tool_calls` for tool call chunks, and `[DONE]` terminator.

---

## Agent Loop (`src/agent/loop.ts`)

Direct port of `envoi/web/agent-loop.js` with TypeScript types. Same TOOLS array (bash, read_file, write_file, list_directory, search_files, get_system_info, web_search).

```typescript
export async function runAgentLoop(opts: {
  messages: Message[];
  onChunk: (delta: string) => void;
  onToolCall: (name: string, input: Record<string, any>, output: string) => void;
  signal: AbortSignal;
  serverUrl: string;
  token: string;
}): Promise<void>
```

Loop:
1. `POST /v1/chat/completions` with `stream: true` via `serverUrl` + Bearer token
2. Parse SSE → call `onChunk` for text deltas
3. On `tool_call_start/args` → buffer args JSON, call `POST /tools` when complete → call `onToolCall`
4. Append tool result to messages, loop again
5. Exits when stream ends with no tool calls

Config (`model`, `base_url`, `project_root`, `temperature`) fetched from `GET /config` before loop starts.

---

## Chat Screen Flow

1. Screen mounts → no session yet, show empty state
2. User types → send button activates (amber)
3. User taps send:
   - Append `{role: "user"}` message
   - `POST /sessions` to create session → store `sessionId`
   - Append empty `{role: "assistant", streaming: true}` placeholder
   - Start `runAgentLoop` with AbortController
   - `onChunk` → append delta to last assistant message's `content`
   - `onToolCall(name, input, output)` → append `ToolCall` to last assistant message
4. Stream ends → set `streaming: false` on last assistant message
5. `POST /sessions/:id/messages` to persist turn
6. Stop button (■) → `abortController.abort()`

---

## UI Components

### MessageBubble
- User: right-aligned, amber tint background
- Assistant: left-aligned, dark surface
- Blinking cursor: `|` character rendered only when `streaming: true`, 500ms opacity animation

### ToolCallPill
- Collapsed: `[🔧 bash ✓]` or `[⚙ read_file ●]`
- Status colours: running = amber `●`, done = green `✓`, error = red `✗`
- Tap → toggles `expanded` flag on the ToolCall
- Expanded: shows INPUT (args JSON) and OUTPUT (result string) in dark boxes

### InputBar
- `TextInput` with `multiline`, `maxHeight: 120` (~4 lines)
- Send button: amber circle with `↑`, disabled (grey) when empty or streaming
- Stop button: red circle with `■`, shown only while streaming
- `KeyboardAvoidingView` wraps the whole screen

### ChatScreen header
- Model name (from config) on left, grey
- ✏ New button on right — clears messages, nulls sessionId

---

## Error Handling
- Network error during stream → show inline error message in chat (`"Connection lost — tap to retry"`)
- Tool execution error → `ToolCall.status = "error"`, pill shows `✗`, output shows error text
- 401 from server → `clearCredentials()` + navigate to ConnectScreen

---

## Testing
Manual golden path:
1. Open app → Connect tab, pair, go to Chat
2. Type "hello" → send → AI responds with streaming text + blinking cursor
3. Type "list files in current dir" → agent uses `list_directory` tool → pill appears, tapping expands to show output
4. Tap Stop mid-response → stream aborts, message ends where it stopped
5. Tap ✏ New → screen clears, back to empty state
