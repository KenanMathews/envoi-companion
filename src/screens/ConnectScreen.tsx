import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ConnectStackParamList } from "../navigation/index";

type Props = NativeStackScreenProps<ConnectStackParamList, "Connect">;

export default function ConnectScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envoi</Text>
      <Text style={styles.subtitle}>
        Open Envoi in your browser, go to Settings → Mobile, then scan the QR code.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Scan")}
      >
        <Text style={styles.buttonText}>Scan QR Code</Text>
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
  title: { color: "#e2e8f0", fontSize: 28, fontWeight: "700", marginBottom: 16 },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#fbbf24",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
  },
  buttonText: { color: "#000", fontWeight: "700", fontSize: 16, textAlign: "center" },
});
