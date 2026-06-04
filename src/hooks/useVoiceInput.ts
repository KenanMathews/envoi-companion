import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { getServerUrl, getToken } from "../store/auth";
import { apiFetch } from "../api/client";

export type VoiceInputState = {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  voiceEnabled: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
};

export function useVoiceInput(): VoiceInputState {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check voice_enabled from server config on mount
  useEffect(() => {
    apiFetch<{ voice_enabled: boolean }>("/config").then((r) => {
      if (r.ok) setVoiceEnabled(!!r.data.voice_enabled);
    });
  }, []);

  function scheduleErrorClear() {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 2000);
  }

  const startRecording = useCallback(async () => {
    if (!voiceEnabled) {
      setError("Enable voice in Settings");
      scheduleErrorClear();
      return;
    }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone access denied");
        scheduleErrorClear();
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.MEDIUM_QUALITY
      );
      recordingRef.current = recording;
      setTranscript("");
      setError(null);
      setIsRecording(true);
    } catch {
      setError("Failed to start recording");
      scheduleErrorClear();
    }
  }, [voiceEnabled]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();

      if (!uri) {
        setIsRecording(false);
        setError("No audio captured");
        scheduleErrorClear();
        return;
      }

      // Read audio file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to Envoi server as JSON
      const serverUrl = await getServerUrl();
      const token = await getToken();
      if (!serverUrl || !token) {
        setIsRecording(false);
        return;
      }

      const res = await fetch(`${serverUrl}/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio: base64, format: "m4a" }),
      });

      const rawText = await res.text();
      console.log("[transcribe] status:", res.status, "body:", rawText.slice(0, 300));
      let data: any = {};
      try { data = JSON.parse(rawText); } catch { data = { error: `Non-JSON response: ${rawText.slice(0, 100)}` }; }
      if (data.error === "voice_disabled") {
        setError("Enable voice in Settings");
        scheduleErrorClear();
      } else if (data.text?.trim()) {
        setTranscript(data.text.trim());
      } else {
        setError(data.error ?? "No speech detected");
        scheduleErrorClear();
      }
    } catch {
      setError("Transcription failed");
      scheduleErrorClear();
    } finally {
      setIsRecording(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  return { isRecording, transcript, error, voiceEnabled, startRecording, stopRecording };
}
