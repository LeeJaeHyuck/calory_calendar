import { Tabs } from "expo-router";
import { useFonts } from "expo-font";
import { Poppins_400Regular, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { NotoSansKR_400Regular, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";
import AppLoading from "expo-app-loading";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    NotoSansKR_400Regular,
    NotoSansKR_700Bold,
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF80A0",
        tabBarInactiveTintColor: "#FFB6C1",
        tabBarStyle: {
          backgroundColor: "#FFF5F8",
          borderTopColor: "#FFD6E0",
          height: 70,
        },
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 14,
          marginBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="daily" options={{ title: "일별" }} />
      <Tabs.Screen name="weekly" options={{ title: "주별" }} />
      <Tabs.Screen name="monthly" options={{ title: "월별" }} />
    </Tabs>
  );
}
