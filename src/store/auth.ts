import * as SecureStore from "expo-secure-store";

const KEY_URL = "envoi_server_url";
const KEY_TOKEN = "envoi_token";

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_URL);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_TOKEN);
}

export async function saveCredentials(url: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_URL, url);
  await SecureStore.setItemAsync(KEY_TOKEN, token);
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_URL);
  await SecureStore.deleteItemAsync(KEY_TOKEN);
}

export async function isPaired(): Promise<boolean> {
  const url = await getServerUrl();
  const token = await getToken();
  return Boolean(url && token);
}
