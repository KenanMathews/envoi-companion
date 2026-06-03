import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { C } from "../theme";

const PRESETS = [
  { group: "Claude", models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  { group: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { group: "Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { group: "Ollama (local)", models: ["llama3.2", "mistral", "codellama", "gemma2"] },
];

type Item =
  | { type: "group"; label: string }
  | { type: "model"; value: string };

function buildList(current: string): Item[] {
  const items: Item[] = [];
  const allPresets = PRESETS.flatMap((g) => g.models);
  if (current && !allPresets.includes(current)) {
    items.push({ type: "group", label: "Current" });
    items.push({ type: "model", value: current });
  }
  for (const { group, models } of PRESETS) {
    items.push({ type: "group", label: group });
    for (const m of models) items.push({ type: "model", value: m });
  }
  return items;
}

type Props = {
  visible: boolean;
  current: string;
  onSelect: (model: string) => void;
  onClose: () => void;
};

export default function ModelPicker({ visible, current, onSelect, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  function handleCustomSubmit() {
    const trimmed = customText.trim();
    if (trimmed) {
      onSelect(trimmed);
      setCustomText("");
    }
  }

  const items = buildList(current);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />
        <Text style={styles.title}>Select model</Text>

        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          style={styles.list}
          renderItem={({ item }) => {
            if (item.type === "group") {
              return <Text style={styles.groupLabel}>{item.label}</Text>;
            }
            const selected = item.value === current;
            return (
              <TouchableOpacity
                style={[styles.modelRow, selected && styles.modelRowSelected]}
                onPress={() => onSelect(item.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modelText, selected && styles.modelTextSelected]}>
                  {item.value}
                </Text>
                {selected && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <View style={styles.customSection}>
              <Text style={styles.groupLabel}>Custom</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="Enter model name…"
                  placeholderTextColor={C.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleCustomSubmit}
                />
                <TouchableOpacity
                  style={[styles.customBtn, !customText.trim() && styles.customBtnDisabled]}
                  onPress={handleCustomSubmit}
                  disabled={!customText.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.customBtnText}>Use</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: C.line,
    maxHeight: "75%",
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: C.line,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    color: C.soft,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  list: { flex: 1 },
  groupLabel: {
    color: C.faint,
    fontSize: 11,
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  modelRowSelected: {
    backgroundColor: C.bg2,
  },
  modelText: {
    flex: 1,
    color: C.ink,
    fontSize: 14,
    fontFamily: "monospace",
  },
  modelTextSelected: { color: C.accent },
  check: { color: C.accent, fontSize: 16 },
  customSection: { paddingBottom: 8 },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  customInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.ink,
    fontSize: 14,
  },
  customBtn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  customBtnDisabled: { backgroundColor: C.line },
  customBtnText: { color: C.bg, fontWeight: "700", fontSize: 13 },
});
