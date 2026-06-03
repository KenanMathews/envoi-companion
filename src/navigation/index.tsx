import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { isPaired } from "../store/auth";

import ConnectScreen from "../screens/ConnectScreen";
import ScanScreen from "../screens/ScanScreen";
import WaitingScreen from "../screens/WaitingScreen";
import ConnectedScreen from "../screens/ConnectedScreen";
import ChatScreen from "../screens/ChatScreen";
import HistoryScreen from "../screens/HistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";

export type ConnectStackParamList = {
  Connect: undefined;
  Scan: undefined;
  Waiting: { sessionId: string; serverUrl: string };
  Connected: undefined;
};

export type MainTabParamList = {
  Chat: { sessionId: string } | undefined;
  History: undefined;
  Settings: undefined;
};

const ConnectStack = createNativeStackNavigator<ConnectStackParamList>();
const Tab = createBottomTabNavigator();

function ConnectFlow() {
  return (
    <ConnectStack.Navigator screenOptions={{ headerShown: false }}>
      <ConnectStack.Screen name="Connect" component={ConnectScreen} />
      <ConnectStack.Screen name="Scan" component={ScanScreen} />
      <ConnectStack.Screen name="Waiting" component={WaitingScreen} />
      <ConnectStack.Screen name="Connected" component={ConnectedScreen} />
    </ConnectStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#26211c", borderTopColor: "#3a342c" },
        tabBarActiveTintColor: "#e8a33d",
        tabBarInactiveTintColor: "#7d7466",
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>🕐</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [paired, setPaired] = useState<boolean | null>(null);

  useEffect(() => {
    isPaired().then(setPaired);
  }, []);

  // Poll every 2s so the app switches to MainTabs as soon as pairing completes
  useEffect(() => {
    const interval = setInterval(() => isPaired().then(setPaired), 2000);
    return () => clearInterval(interval);
  }, []);

  if (paired === null) return null;

  return (
    <NavigationContainer>
      {paired ? <MainTabs /> : <ConnectFlow />}
    </NavigationContainer>
  );
}
