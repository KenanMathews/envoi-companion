import React, { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from "react-native";
import { C } from "../theme";

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
        placeholderTextColor={C.faint}
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
    borderTopColor: C.line,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.ink,
    fontSize: 14,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: C.accent,
    borderRadius: 50,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: C.line },
  sendIcon: { color: C.bg, fontWeight: "700", fontSize: 16 },
  stopBtn: {
    backgroundColor: C.danger,
    borderRadius: 50,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stopIcon: { color: C.ink, fontSize: 12 },
});
