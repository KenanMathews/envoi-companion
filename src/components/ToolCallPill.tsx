import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { ToolCall } from "../agent/types";
import { C } from "../theme";

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
    toolCall.status === "done" ? C.success : toolCall.status === "error" ? C.danger : C.accent;
  const statusSymbol =
    toolCall.status === "done" ? "✓" : toolCall.status === "error" ? "✗" : "●";

  return (
    <TouchableOpacity onPress={() => onToggle(toolCall.id)} activeOpacity={0.7}>
      <View style={styles.pill}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{toolCall.name}</Text>
        <Text style={[styles.status, { color: statusColor }]}>{statusSymbol}</Text>
      </View>

      {toolCall.expanded && (
        <View style={styles.expanded}>
          <View style={styles.expandedHeader}>
            <View style={styles.expandedTitle}>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={[styles.name, { color: C.accent }]}>{toolCall.name}</Text>
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
            <Text style={styles.blockText}>{JSON.stringify(toolCall.input, null, 2)}</Text>
          </View>

          {toolCall.output !== undefined && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>OUTPUT</Text>
              <Text style={styles.blockText} numberOfLines={10}>{toolCall.output}</Text>
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
    backgroundColor: C.panel,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: C.line,
  },
  icon: { fontSize: 11 },
  name: { color: C.soft, fontSize: 11, fontFamily: "monospace" },
  status: { fontSize: 10 },
  expanded: {
    backgroundColor: C.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
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
  chevron: { color: C.faint, fontSize: 10 },
  block: { backgroundColor: C.bg, borderRadius: 6, padding: 7 },
  blockLabel: { color: C.faint, fontSize: 8, marginBottom: 3 },
  blockText: { color: C.soft, fontSize: 10, fontFamily: "monospace", lineHeight: 16 },
});
