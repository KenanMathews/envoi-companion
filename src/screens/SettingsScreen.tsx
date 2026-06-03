import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from "react-native";
import { getServerUrl, clearCredentials } from "../store/auth";
import { apiFetch } from "../api/client";
import { C } from "../theme";

type ServerConfig = {
  model: string;
  base_url: string;
  project_root: string;
  temperature: number;
  system_prompt: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value || "—"}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [urlResult, configResult] = await Promise.all([
      getServerUrl(),
      apiFetch<ServerConfig>("/config"),
    ]);
    setServerUrl(urlResult);
    if (configResult.ok) {
      setConnected(true);
      setConfig(configResult.data);
    } else {
      setConnected(false);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  function providerName(url: string): string {
    if (!url) return "—";
    if (url.includes("aicredits")) return "AICredits";
    if (url.includes("openrouter")) return "OpenRouter";
    if (url.includes("openai.com")) return "OpenAI";
    if (url.includes("localhost") || url.includes("127.0.0.1")) return "Local (Ollama)";
    if (url.includes("anthropic")) return "Anthropic";
    try { return new URL(url).hostname; } catch { return url; }
  }

  const statusColor = connected === true ? C.success : connected === false ? C.danger : C.faint;
  const statusLabel = connected === true ? "Connected" : connected === false ? "Unreachable" : "Checking…";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.accent} />
        }
      >
        {/* SERVER section */}
        <Text style={styles.sectionLabel}>SERVER</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Address</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{serverUrl ?? "—"}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <Divider />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status</Text>
            <Text style={[styles.rowValue, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* CONFIGURATION section */}
        {config && (
          <>
            <Text style={styles.sectionLabel}>CONFIGURATION</Text>
            <View style={styles.card}>
              <Row label="Model" value={config.model} />
              <Divider />
              <Row label="Provider" value={providerName(config.base_url)} />
              <Divider />
              <Row label="Project root" value={config.project_root} />
              <Divider />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Temperature</Text>
                <View style={styles.tempRow}>
                  <View style={styles.tempBar}>
                    <View style={[styles.tempFill, { width: `${(config.temperature / 2) * 100}%` }]} />
                  </View>
                  <Text style={styles.tempValue}>{config.temperature.toFixed(1)}</Text>
                </View>
              </View>
              {!!config.system_prompt && (
                <>
                  <Divider />
                  <View style={styles.promptRow}>
                    <Text style={styles.rowLabel}>System prompt</Text>
                    <Text style={styles.promptText} numberOfLines={3}>{config.system_prompt}</Text>
                  </View>
                </>
              )}
            </View>
            <Text style={styles.hint}>Edit these settings in the Envoi web UI.</Text>
          </>
        )}

        {/* ACCOUNT section */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity onPress={handleForget} style={styles.dangerRow} activeOpacity={0.7}>
            <Text style={styles.dangerText}>Forget this server</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: { padding: 20, paddingBottom: 40 },
  sectionLabel: { color: C.faint, fontSize: 11, letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  card: {
    backgroundColor: C.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rowLabel: { color: C.soft, fontSize: 14, width: 100, flexShrink: 0 },
  rowValue: { color: C.ink, fontSize: 14, flex: 1, textAlign: "right" },
  statusDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  divider: { height: 1, backgroundColor: C.line, marginHorizontal: 14 },
  tempRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  tempBar: {
    width: 80,
    height: 4,
    backgroundColor: C.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  tempFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  tempValue: { color: C.ink, fontSize: 14, width: 28, textAlign: "right" },
  promptRow: { paddingHorizontal: 14, paddingVertical: 12 },
  promptText: { color: C.soft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  hint: { color: C.faint, fontSize: 11, marginTop: 6, marginBottom: 24 },
  dangerRow: { paddingHorizontal: 14, paddingVertical: 14 },
  dangerText: { color: C.danger, fontSize: 15 },
});
