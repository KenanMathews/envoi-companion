# Voice Input Design

## Overview

Add hold-to-record voice input to the chat screen. User holds the mic button in the InputBar, speaks, releases — transcript drops into the text input ready to send. Output stays as normal text chat bubbles. No TTS.

---

## Scope

**In scope:**
- Mic button added to `InputBar` (left of text input)
- Hold-to-record interaction via `expo-speech-recognition`
- 4 visual states: idle, recording (waveform + timer), transcript ready, error
- Microphone permission request on first use
- `useVoiceInput` hook encapsulating all recognition lifecycle

**Out of scope:**
- TTS / reading AI responses aloud (future)
- Dedicated Voice tab (future — sub-project 2)
- Whisper API fallback
- Language selection

---

## Architecture

### Files

| File | Status | Responsibility |
|---|---|---|
| `src/hooks/useVoiceInput.ts` | Create | `expo-speech-recognition` lifecycle — start, stop, partial results, errors |
| `src/components/InputBar.tsx` | Modify | Mic button + 4 visual states, wires transcript into text state |
| `app.json` | Modify | Add `expo-speech-recognition` plugin |

Agent loop, sessions, and message bubbles are untouched.

### Dependency

```bash
npx expo install expo-speech-recognition
```

`app.json` plugin entry:
```json
"plugins": [
  "expo-speech-recognition",
  ...existing plugins
]
```

---

## `useVoiceInput` Hook

```typescript
const { isRecording, transcript, error, startRecording, stopRecording } = useVoiceInput();
```

### State
- `isRecording: boolean` — true while recognition is active
- `transcript: string` — latest partial/final result
- `error: string | null` — set on recognition error, cleared after 2s

### Behaviour

**`startRecording()`:**
1. Request microphone permission — if denied, set `error = "Microphone permission denied"` and return
2. Call `ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true })`
3. Set `isRecording = true`, clear `transcript` and `error`

**During recording:**
- `result` events with `isFinal: false` → update `transcript` (partial, shown live)
- `result` event with `isFinal: true` → update `transcript` (final)

**`stopRecording()`:**
1. Call `ExpoSpeechRecognitionModule.stop()`
2. Set `isRecording = false`
3. Final `result` event fires → `transcript` set to final value

**On `error` event:**
1. Set `isRecording = false`
2. Set `error = "No speech detected"` (or specific message)
3. Auto-clear `error` after 2000ms

**Cleanup:**
- Remove all event listeners on unmount
- Call `ExpoSpeechRecognitionModule.abort()` if recording when unmounted

---

## InputBar Changes

### New prop
```typescript
// No new props needed — voice is self-contained within InputBar
// InputBar manages voice state internally via useVoiceInput
```

### Visual states

| State | Mic button | Input area | Send button |
|---|---|---|---|
| **Idle** | Muted icon, `opacity: 0.6` | Normal placeholder | Grey (disabled if empty) |
| **Recording** | Amber outline + pulse glow | Waveform bars animation + `0:00` timer | Grey |
| **Transcript** | Muted icon | Transcript text (editable) | Amber ↑ (enabled) |
| **Error** | Red outline, fades after 2s | "No speech detected" in danger colour | Grey |

### Interaction

- `PressIn` on mic button → `startRecording()`
- `PressOut` on mic button → `stopRecording()`
- When `transcript` becomes non-empty and `isRecording === false` → set `text = transcript` in InputBar state
- User can edit the transcript before sending
- Sending clears text as normal
- Mic button disabled while AI is streaming (`streaming === true` prop)

### Waveform animation

5–7 bars, each animating `scaleY` on a slight offset interval using `Animated.loop` + `Animated.sequence`. Bars visible only while `isRecording === true`. Timer counts up from 0:00 using `setInterval`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Mic permission denied | `error = "Microphone access denied"`, shows in input area, no recording |
| No speech in 5s | OS fires error event → "No speech detected", clears after 2s |
| Recognition service unavailable | `error = "Speech recognition unavailable"`, clears after 2s |
| Hold released before any speech | Same as no speech |
| Streaming in progress | Mic button disabled (same as send button) |

---

## Testing

1. Hold mic → waveform animates, timer counts up
2. Say something → release → transcript appears in input
3. Tap ↑ → message sends normally, response appears as text bubble
4. Hold and say nothing → "No speech detected" appears, clears after 2s
5. While AI is streaming, mic button is disabled
6. First use → OS permission prompt appears; declining shows error state
