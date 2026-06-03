import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TextInput,
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

function Divider() {
  return <View style={styles.divider} />;
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

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [modelDraft, setModelDraft] = useState("");
  const modelInputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    const [urlResult, configResult] = await Promise.all([
      getServerUrl(),
      apiFetch<ServerConfig>("/config"),
    ]);
    setServerUrl(urlResult);
    if (configResult.ok) {
      setConnected(true);
      setConfig(configResult.data);
      setModelDraft(configResult.data.model);
    } else {
      setConnected(false);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveConfig(patch: Partial<ServerConfig>) {
    if (!config) return;
    const updated = { ...config, ...patch };
    setConfig(updated);
    await apiFetch("/config", {
      method: "POST",
      body: JSON.stringify(patch),
    });
  }

  function handleModelEdit() {
    setEditingModel(true);
    setTimeout(() => modelInputRef.current?.focus(), 50);
  }

  function handleModelSave() {
    setEditingModel(false);
    const trimmed = modelDraft.trim();
    if (trimmed && trimmed !== config?.model) {
      saveConfig({ model: trimmed });
    }
  }

  function handleTempChange(delta: number) {
    if (!config) return;
    const next = Math.round(Math.max(0, Math.min(2, config.temperature + delta)) * 10) / 10;
    saveConfig({ temperature: next });
  }

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* SERVER */}
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
          {config && (
            <>
              <Divider />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Provider</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{providerName(config.base_url)}</Text>
              </View>
            </>
          )}
        </View>

        {/* MODEL & TEMPERATURE */}
        {config && (
          <>
            <Text style={styles.sectionLabel}>MODEL</Text>
            <View style={styles.card}>
              {/* Model — editable */}
              <TouchableOpacity style={styles.row} onPress={handleModelEdit} activeOpacity={0.7}>
                <Text style={styles.rowLabel}>Model</Text>
                {editingModel ? (
                  <TextInput
                    ref={modelInputRef}
                    style={styles.modelInput}
                    value={modelDraft}
                    onChangeText={setModelDraft}
                    onBlur={handleModelSave}
                    onSubmitEditing={handleModelSave}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={[styles.rowValue, { color: C.accent }]} numberOfLines={1}>
                    {config.model || "—"}
                  </Text>
                )}
                {!editingModel && <Text style={styles.editHint}>✎</Text>}
              </TouchableOpacity>

              <Divider />

              {/* Temperature — stepper */}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Temperature</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepBtn, config.temperature <= 0 && styles.stepBtnDisabled]}
                    onPress={() => handleTempChange(-0.1)}
                    disabled={config.temperature <= 0}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.tempDisplay}>
                    <Text style={styles.tempValue}>{config.temperature.toFixed(1)}</Text>
                    <View style={styles.tempBar}>
                      <View style={[styles.tempFill, { width: `${(config.temperature / 2) * 100}%` }]} />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepBtn, config.temperature >= 2 && styles.stepBtnDisabled]}
                    onPress={() => handleTempChange(0.1)}
                    disabled={config.temperature >= 2}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <Text style={styles.hint}>Changes save immediately to the server.</Text>
          </>
        )}

        {/* PROJECT */}
        {config?.project_root ? (
          <>
            <Text style={styles.sectionLabel}>PROJECT</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Root</Text>
                <Text style={styles.rowValue} numberOfLines={2}>{config.project_root}</Text>
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
          </>
        ) : null}

        {/* ACCOUNT */}
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
  rowLabel: { color: C.soft, fontSize: 14, width: 90, flexShrink: 0 },
  rowValue: { color: C.ink, fontSize: 14, flex: 1, textAlign: "right" },
  statusDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  divider: { height: 1, backgroundColor: C.line, marginHorizontal: 14 },
  editHint: { color: C.faint, fontSize: 13 },
  modelInput: {
    flex: 1,
    color: C.accent,
    fontSize: 14,
    textAlign: "right",
    paddingVertical: 0,
  },
  stepper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.3 },
  stepBtnText: { color: C.ink, fontSize: 18, lineHeight: 22 },
  tempDisplay: { alignItems: "center", gap: 4 },
  tempValue: { color: C.ink, fontSize: 14, fontVariant: ["tabular-nums"] },
  tempBar: { width: 60, height: 3, backgroundColor: C.line, borderRadius: 2, overflow: "hidden" },
  tempFill: { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  promptRow: { paddingHorizontal: 14, paddingVertical: 12 },
  promptText: { color: C.soft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  hint: { color: C.faint, fontSize: 11, marginTop: 6, marginBottom: 24 },
  dangerRow: { paddingHorizontal: 14, paddingVertical: 14 },
  dangerText: { color: C.danger, fontSize: 15 },
});
