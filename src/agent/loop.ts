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
