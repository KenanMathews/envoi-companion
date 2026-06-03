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
  const [pingStatus, setPingStatus] = useState<"checking" | "ok" | "fail">("checking");
  const [pingDetail, setPingDetail] = useState("");
  const [message, setMessage] = useState("Waiting for approval…");
  const [expiresIn, setExpiresIn] = useState(60);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function init() {
      // Step 1: ping the server to verify connectivity
      try {
        const res = await fetch(`${serverUrl}/ping`, { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        if (d.ok) {
          setPingStatus("ok");
          setPingDetail(`Reached ${serverUrl}`);
        } else {
          setPingStatus("fail");
          setPingDetail(`Unexpected response from ${serverUrl}`);
          return;
        }
      } catch (e: any) {
        setPingStatus("fail");
        setPingDetail(`Cannot reach ${serverUrl}: ${e.message}`);
        return;
      }

      // Step 2: register the scan
      const pairResult = await pairingFetch(serverUrl, "/auth/pair", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, device_name: "Envoi Mobile" }),
      });
      if (!pairResult.ok) {
        setMessage(`Pair failed: ${pairResult.error}`);
        return;
      }

      // Step 3: poll for approval
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
    }

    init();
    return () => clearInterval(pollRef.current!);
  }, []);

  return (
    <View style={styles.container}>
      {/* Connectivity status */}
      <View style={styles.pingRow}>
        <View style={[styles.dot, {
          backgroundColor: pingStatus === "ok" ? "#4ade80" : pingStatus === "fail" ? "#ef4444" : "#fbbf24"
        }]} />
        <Text style={styles.pingText}>
          {pingStatus === "checking" ? `Connecting to ${serverUrl}…` : pingDetail}
        </Text>
      </View>

      {pingStatus === "fail" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Cannot reach server</Text>
          <Text style={styles.errorDetail}>{pingDetail}</Text>
          <Text style={styles.errorHint}>
            Make sure Envoi is running and your phone is on the same Wi-Fi.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace("Connect")}>
            <Text style={styles.backBtnText}>← Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {pingStatus === "ok" && (
        <>
          <ActivityIndicator size="large" color="#fbbf24" style={{ marginBottom: 24 }} />
          <Text style={styles.title}>Waiting for approval</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <Text style={styles.hint}>
            Click{" "}
            <Text style={{ color: "#fbbf24", fontWeight: "700" }}>Allow</Text>{" "}
            in your browser to connect
          </Text>
          <Text style={styles.countdown}>Expires in {expiresIn}s</Text>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.replace("Connect")}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
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
  pingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 10,
    width: "100%",
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  pingText: { color: "#94a3b8", fontSize: 11, flex: 1 },
  errorBox: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  errorTitle: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  errorDetail: { color: "#94a3b8", fontSize: 12, textAlign: "center" },
  errorHint: { color: "#475569", fontSize: 11, textAlign: "center", marginTop: 4 },
  backBtn: { marginTop: 16, backgroundColor: "#fbbf24", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText: { color: "#000", fontWeight: "700" },
  title: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  subtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", marginBottom: 8 },
  hint: { color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 16 },
  countdown: { color: "#475569", fontSize: 12 },
  cancelBtn: { marginTop: 32 },
  cancelText: { color: "#ef4444", fontSize: 14 },
});
