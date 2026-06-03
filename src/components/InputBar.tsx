import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { C } from "../theme";
import { useVoiceInput } from "../hooks/useVoiceInput";

const BAR_COUNT = 6;

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
};

export default function InputBar({ onSend, onStop, streaming, disabled }: Props) {
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(1))
  ).current;

  const { isRecording, transcript, error, startRecording, stopRecording } =
    useVoiceInput();

  // When recognition finishes and transcript is ready, fill text input
  useEffect(() => {
    if (!isRecording && transcript) {
      setText(transcript);
    }
  }, [isRecording, transcript]);

  // Start/stop waveform animation and timer
  useEffect(() => {
    if (isRecording) {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

      waveLoopsRef.current = barAnims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1.8,
              duration: 200 + i * 40,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 200 + i * 40,
              useNativeDriver: true,
            }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setSeconds(0);
      waveLoopsRef.current.forEach((l) => l.stop());
      waveLoopsRef.current = [];
      barAnims.forEach((a) => a.setValue(1));
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const micDisabled = streaming || disabled;
  const micBorderColor = error ? C.danger : isRecording ? C.accent : C.line;
  const micBg = error
    ? `${C.danger}20`
    : isRecording
    ? `${C.accent}20`
    : C.panel;

  return (
    <View style={styles.container}>
      {/* Mic button — hold to record */}
      <TouchableOpacity
        style={[styles.micBtn, { backgroundColor: micBg, borderColor: micBorderColor }]}
        onPressIn={micDisabled ? undefined : startRecording}
        onPressOut={micDisabled ? undefined : stopRecording}
        disabled={micDisabled}
        activeOpacity={0.8}
      >
        <Text style={[styles.micIcon, micDisabled && styles.micIconDisabled]}>
          🎙
        </Text>
      </TouchableOpacity>

      {/* Center: waveform while recording, text input otherwise */}
      {isRecording ? (
        <View style={[styles.input, styles.waveformContainer]}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[styles.waveBar, { transform: [{ scaleY: anim }] }]}
            />
          ))}
          <Text style={styles.timer}>{formatTime(seconds)}</Text>
        </View>
      ) : (
        <TextInput
          style={[styles.input, !!error && styles.inputError]}
          value={text}
          onChangeText={setText}
          placeholder={error ?? "Message Envoi…"}
          placeholderTextColor={error ? C.danger : C.faint}
          multiline
          maxLength={4000}
          editable={!streaming}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      )}

      {/* Right: stop button while streaming, send button otherwise */}
      {streaming ? (
        <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.8}>
          <Text style={styles.stopIcon}>■</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!text.trim() || disabled || isRecording) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || disabled || isRecording}
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
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  micIcon: { fontSize: 16 },
  micIconDisabled: { opacity: 0.35 },
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
  inputError: { borderColor: `${C.danger}80` },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 40,
    borderColor: `${C.accent}50`,
  },
  waveBar: {
    width: 3,
    height: 16,
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  timer: {
    color: C.soft,
    fontSize: 11,
    marginLeft: 6,
    fontVariant: ["tabular-nums"],
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
