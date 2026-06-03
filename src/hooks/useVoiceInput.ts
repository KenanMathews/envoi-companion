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
