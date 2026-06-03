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
