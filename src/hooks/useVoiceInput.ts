import { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { getServerUrl, getToken } from "../store/auth";

export type VoiceInputState = {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
};

export function useVoiceInput(): VoiceInputState {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleErrorClear() {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 2000);
  }

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone access denied");
        scheduleErrorClear();
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setTranscript("");
      setError(null);
      setIsRecording(true);
    } catch {
      setError("Failed to start recording");
      scheduleErrorClear();
    }
  }, []);

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

      // Upload to Envoi server for transcription (isRecording stays true = waveform shows while uploading)
      const serverUrl = await getServerUrl();
      const token = await getToken();
      if (!serverUrl || !token) {
        setIsRecording(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);

      const res = await fetch(`${serverUrl}/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.text?.trim()) {
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

  return { isRecording, transcript, error, startRecording, stopRecording };
}
