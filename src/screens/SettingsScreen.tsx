import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { getServerUrl, clearCredentials } from "../store/auth";
import { apiFetch } from "../api/client";

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    getServerUrl().then(setServerUrl);
    apiFetch("/config").then((r) => setConnected(r.ok));
  }, []);

  function handleForget() {
    Alert.alert(
      "Forget this server?",
      "You will need to scan the QR code again to reconnect.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: async () => {
            await apiFetch("/auth/revoke", { method: "POST" });
            await clearCredentials();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>SERVER</Text>
        <View style={styles.row}>
          <Text style={styles.url}>{serverUrl ?? "—"}</Text>
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  connected === true
                    ? "#4ade80"
                    : connected === false
                    ? "#ef4444"
                    : "#475569",
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.section}>
        <TouchableOpacity onPress={handleForget}>
          <Text style={styles.danger}>Forget this server</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
    paddingTop: 60,
  },
  section: { marginBottom: 32 },
  label: { color: "#475569", fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  url: { color: "#e2e8f0", fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  danger: { color: "#ef4444", fontSize: 15 },
});
