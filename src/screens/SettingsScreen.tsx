import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from "react-native";
import { getServerUrl, clearCredentials } from "../store/auth";
import { apiFetch } from "../api/client";
import { C } from "../theme";

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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.label}>SERVER</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.url}>{serverUrl ?? "—"}</Text>
              <View style={[styles.dot, {
                backgroundColor: connected === true ? C.success : connected === false ? C.danger : C.faint,
              }]} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity onPress={handleForget} style={styles.dangerRow}>
              <Text style={styles.dangerText}>Forget this server</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.panel,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  container: { padding: 20 },
  section: { marginBottom: 28 },
  label: { color: C.faint, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  card: {
    backgroundColor: C.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  url: { color: C.ink, fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dangerRow: { padding: 14 },
  dangerText: { color: C.danger, fontSize: 15 },
});
