# Voice Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hold-to-record mic button to the chat InputBar using `expo-speech-recognition` — transcript drops into text input on release.

**Architecture:** `useVoiceInput` hook owns all recognition lifecycle. `InputBar` gains a mic button (left of text input) with 4 visual states driven by the hook. `app.json` updated with the speech-recognition plugin. No changes to agent loop or message bubbles.

**Tech Stack:** Expo SDK 54, `expo-speech-recognition` (on-device STT, free), `Animated` API for waveform bars.

**Spec:** `docs/specs/2026-06-04-voice-input-design.md`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app.json` | Modify | Add `expo-speech-recognition` plugin |
| `src/hooks/useVoiceInput.ts` | Create | Recognition lifecycle: start, stop, events, error auto-clear |
| `src/components/InputBar.tsx` | Modify | Mic button + waveform + 4 visual states |

---

## Task 1: Install `expo-speech-recognition` + update `app.json`

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Install the package**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
npx expo install expo-speech-recognition
```

Expected: package appears in `package.json` dependencies.

- [ ] **Step 2: Add plugin to `app.json`**

Open `app.json`. In the `"plugins"` array, add `"expo-speech-recognition"` as the first entry:

```json
{
  "expo": {
    "name": "envoi-companion",
    "slug": "envoi-companion",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSLocalNetworkUsageDescription": "Envoi needs local network access to connect to your server.",
        "NSSpeechRecognitionUsageDescription": "Envoi uses speech recognition to transcribe your voice messages.",
        "NSMicrophoneUsageDescription": "Envoi needs the microphone to record your voice messages."
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-speech-recognition",
      "expo-secure-store",
      "expo-asset",
      "expo-font"
    ]
  }
}
```

Note: `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription` are required by iOS. Without them the app crashes on permission request.

- [ ] **Step 3: Commit**

```bash
git add app.json package.json package-lock.json
git commit -m "feat: install expo-speech-recognition and add iOS permission strings"
```

---

## Task 2: Create `src/hooks/useVoiceInput.ts`

**Files:**
- Create: `src/hooks/useVoiceInput.ts`

- [ ] **Step 1: Create `src/hooks/useVoiceInput.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export type VoiceInputState = {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

export function useVoiceInput(): VoiceInputState {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleErrorClear() {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 2000);
  }

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    setTranscript(text);
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsRecording(false);
    const msg =
      event.error === "no-speech"
        ? "No speech detected"
        : event.error === "not-allowed"
        ? "Microphone access denied"
        : "Speech recognition unavailable";
    setError(msg);
    scheduleErrorClear();
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecording(false);
  });

  const startRecording = useCallback(async () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (status !== "granted") {
      setError("Microphone access denied");
      scheduleErrorClear();
      return;
    }
    setTranscript("");
    setError(null);
    setIsRecording(true);
    ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true });
  }, []);

  const stopRecording = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    // isRecording will be set to false by the "end" event
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      try { ExpoSpeechRecognitionModule.abort(); } catch {}
    };
  }, []);

  return { isRecording, transcript, error, startRecording, stopRecording };
}
```

- [ ] **Step 2: Verify it compiles — check for TypeScript errors**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors mentioning `useVoiceInput.ts` (some unrelated errors in other files are OK).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVoiceInput.ts
git commit -m "feat: useVoiceInput hook with expo-speech-recognition lifecycle"
```

---

## Task 3: Update `InputBar` with mic button + waveform

**Files:**
- Modify: `src/components/InputBar.tsx`

- [ ] **Step 1: Replace `src/components/InputBar.tsx` entirely**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `InputBar.tsx` or `useVoiceInput.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/InputBar.tsx
git commit -m "feat: mic button with hold-to-record, waveform, and transcript fill"
```

---

## Task 4: Manual verification + push

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

1. Chat tab → mic button appears left of input (muted, `opacity: 0.35`)
2. Hold mic → waveform bars animate in amber, timer counts up `0:00`, `0:01`…
3. Say "hello world" → release → transcript "hello world" appears in input, send button turns amber
4. Tap ↑ → message sends, AI responds as normal text bubble
5. Hold and say nothing for ~5s → release → "No speech detected" in red, clears after 2s
6. While AI is streaming → mic button disabled (opacity 0.35)

- [ ] **Step 4: Push to GitHub**

```bash
cd C:\Users\kenan\Documents\proj\envoi-companion
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Mic button left of text input — Task 3 (placed before TextInput in JSX)
- ✅ Hold-to-record (PressIn/PressOut) — Task 3
- ✅ Waveform bars + timer while recording — Task 3
- ✅ Transcript fills text input on release — Task 3 (`useEffect` on `isRecording/transcript`)
- ✅ 4 visual states (idle/recording/transcript/error) — Task 3
- ✅ Mic disabled while streaming — Task 3 (`micDisabled = streaming || disabled`)
- ✅ "No speech detected" auto-clears after 2s — Task 2 (`scheduleErrorClear`)
- ✅ Microphone permission request — Task 2 (`requestPermissionsAsync`)
- ✅ iOS permission strings — Task 1 (`app.json` infoPlist)
- ✅ Cleanup on unmount — Task 2 (`useEffect` cleanup calls `abort()`)

**Type consistency:**
- `useVoiceInput` returns `{ isRecording, transcript, error, startRecording, stopRecording }` — consumed exactly by InputBar ✓
- `VoiceInputState` export type matches return shape ✓
- `barAnims` is `Animated.Value[]`, loops stored as `Animated.CompositeAnimation[]` ✓

**Placeholder scan:** No TBD, TODO, or vague steps found.
