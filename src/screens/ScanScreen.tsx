import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ConnectStackParamList } from "../navigation/index";
import { C } from "../theme";

type Props = NativeStackScreenProps<ConnectStackParamList, "Scan">;

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Camera access is needed to scan the QR code.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    try {
      const parsed = JSON.parse(data) as { session_id: string; url: string };
      if (!parsed.session_id || !parsed.url) throw new Error("Invalid QR");
      navigation.replace("Waiting", {
        sessionId: parsed.session_id,
        serverUrl: parsed.url,
      });
    } catch {
      setScanned(false); // bad QR — allow retry
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Point at the QR code in Envoi Settings</Text>
      </View>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  overlay: { alignItems: "center", justifyContent: "center" },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: C.accent,
    borderRadius: 12,
    marginBottom: 24,
  },
  hint: { color: C.ink, fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  subtitle: { color: C.soft, textAlign: "center", margin: 32, lineHeight: 22 },
  button: {
    backgroundColor: C.accent,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 32,
    width: "80%",
  },
  buttonText: { color: C.bg, fontWeight: "700", textAlign: "center" },
  backBtn: { position: "absolute", top: 60, left: 20, padding: 10 },
  backText: { color: C.soft, fontSize: 15 },
});
