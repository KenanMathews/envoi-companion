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
