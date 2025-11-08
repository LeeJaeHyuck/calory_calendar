import { NotoSansKR_400Regular, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";
import { Poppins_400Regular, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// 스플래시 스크린이 자동으로 숨겨지지 않도록 설정
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    NotoSansKR_400Regular,
    NotoSansKR_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // 폰트 로드가 완료되면 스플래시 스크린 숨기기
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
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
      <Tabs.Screen name="setting" options={{ title: "설정" }} />
    </Tabs>
  );
}
