import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ConnectStackParamList } from "../navigation/index";

type Props = NativeStackScreenProps<ConnectStackParamList, "Connected">;

export default function ConnectedScreen({ navigation }: Props) {
  useEffect(() => {
    // Root navigator will switch to MainTabs once credentials exist.
    // Brief delay so the success state is visible.
    const t = setTimeout(() => navigation.replace("Connect"), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.title}>Connected!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: "#4ade80", fontSize: 64, marginBottom: 12 },
  title: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
});
