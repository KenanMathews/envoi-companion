import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ConnectStackParamList } from "../navigation/index";
import { pairingFetch } from "../api/client";
import { saveCredentials } from "../store/auth";

type Props = NativeStackScreenProps<ConnectStackParamList, "Waiting">;

type StatusResponse = {
  status: "waiting" | "pending" | "confirmed" | "denied" | "expired";
  token?: string;
  expires_in?: number;
};

export default function WaitingScreen({ navigation, route }: Props) {
  const { sessionId, serverUrl } = route.params;
  const [message, setMessage] = useState("Waiting for approval…");
  const [expiresIn, setExpiresIn] = useState(60);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Register the scan with the server so it shows Allow/Deny in the browser
    pairingFetch(serverUrl, "/auth/pair", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, device_name: "Envoi Mobile" }),
    });

    pollRef.current = setInterval(async () => {
      const result = await pairingFetch<StatusResponse>(
        serverUrl,
        `/auth/pair/status?session_id=${sessionId}`
      );
      if (!result.ok) return;
      const { status, token, expires_in } = result.data;
      if (expires_in !== undefined) setExpiresIn(expires_in);
      if (status === "confirmed" && token) {
        clearInterval(pollRef.current!);
        await saveCredentials(serverUrl, token);
        navigation.replace("Connected");
      } else if (status === "denied") {
        clearInterval(pollRef.current!);
        setMessage("Connection denied");
        setTimeout(() => navigation.replace("Connect"), 2000);
      } else if (status === "expired") {
        clearInterval(pollRef.current!);
        setMessage("QR expired — please scan again");
        setTimeout(() => navigation.replace("Connect"), 2000);
      }
    }, 1500);
    return () => clearInterval(pollRef.current!);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#fbbf24" style={{ marginBottom: 24 }} />
      <Text style={styles.title}>Waiting for approval</Text>
      <Text style={styles.subtitle}>{message}</Text>
      <Text style={styles.hint}>
        Click{" "}
        <Text style={{ color: "#fbbf24", fontWeight: "700" }}>Allow</Text> in
        your browser to connect
      </Text>
      <Text style={styles.countdown}>Expires in {expiresIn}s</Text>
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => navigation.replace("Connect")}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  subtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", marginBottom: 8 },
  hint: { color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 16 },
  countdown: { color: "#475569", fontSize: 12 },
  cancelBtn: { marginTop: 32 },
  cancelText: { color: "#ef4444", fontSize: 14 },
});
