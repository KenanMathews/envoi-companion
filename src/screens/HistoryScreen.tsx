import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { apiFetch } from "../api/client";
import { C } from "../theme";
import type { MainTabParamList } from "../navigation/index";

type Session = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

type Nav = BottomTabNavigationProp<MainTabParamList, "History">;

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filtered, setFiltered] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await apiFetch<Session[]>("/sessions");
    if (result.ok) {
      setSessions(result.data);
      setFiltered(result.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(sessions);
    } else {
      const q = query.toLowerCase();
      setFiltered(sessions.filter((s) => s.title.toLowerCase().includes(q)));
    }
  }, [query, sessions]);

  function handleOpen(session: Session) {
    navigation.navigate("Chat", { sessionId: session.id });
  }

  function handleDelete(session: Session) {
    Alert.alert(
      "Delete session?",
      `"${session.title}" will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await apiFetch(`/sessions/${session.id}`, { method: "DELETE" });
            setSessions((prev) => prev.filter((s) => s.id !== session.id));
          },
        },
      ]
    );
  }

  function renderItem({ item }: { item: Session }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpen(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{relativeTime(item.updated_at)}</Text>
          {item.model ? (
            <Text style={styles.metaModel} numberOfLines={1}>{item.model}</Text>
          ) : null}
          {item.message_count > 0 ? (
            <Text style={styles.metaText}>{item.message_count} msgs</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  const isEmpty = !loading && filtered.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {sessions.length > 0 && (
          <Text style={styles.headerCount}>{sessions.length}</Text>
        )}
      </View>

      {/* Search bar */}
      {sessions.length > 0 && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search sessions…"
            placeholderTextColor="#475569"
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={isEmpty ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#fbbf24"
          />
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🕐</Text>
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyHint}>
                {query ? "No sessions match your search." : "Start a chat and it'll appear here."}
              </Text>
            </View>
          ) : null
        }
      />

      <Text style={styles.hint}>Long press a session to delete it</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.panel,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  headerCount: {
    color: C.accent,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: C.user,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  searchRow: { padding: 12, paddingBottom: 6 },
  search: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: C.ink,
    fontSize: 14,
  },
  listContent: { padding: 12, gap: 8 },
  card: {
    backgroundColor: C.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginBottom: 8,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: { color: C.ink, fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  chevron: { color: C.accent, fontSize: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  metaText: { color: C.faint, fontSize: 11 },
  metaModel: { color: C.soft, fontSize: 11, fontFamily: "monospace", flex: 1 },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptyHint: { color: C.faint, fontSize: 13, textAlign: "center", lineHeight: 20 },
  hint: { color: C.line, fontSize: 10, textAlign: "center", paddingVertical: 8 },
});
