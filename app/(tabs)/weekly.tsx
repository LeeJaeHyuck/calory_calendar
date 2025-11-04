import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

const KR_DAY = ["일", "월", "화", "수", "목", "금", "토"];
const formatDate = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
};

export default function WeeklyScreen() {
  const [weekData, setWeekData] = useState<{ date: string; total: number }[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const router = useRouter();

  const loadWeeklyData = useCallback(async () => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);

    // 월요일로 이동 (0=일 → 월요일까지 거리 = (day+6)%7)
    const day = base.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - diffToMonday);

    const results: { date: string; total: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDate(d);

      const raw = await AsyncStorage.getItem(`meals-${dateStr}`);
      const total = raw
        ? Object.values(JSON.parse(raw)).flat().reduce((s: number, m: any) => s + (m.kcal || 0), 0)
        : 0;

      results.push({ date: dateStr, total });
    }
    setWeekData(results);
  }, [weekOffset]);

  useFocusEffect(useCallback(() => { loadWeeklyData(); }, [loadWeeklyData]));

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🍰 주간 섭취 기록</Text>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset((p) => p - 1)}>
          <Text style={styles.navText}>◀ 전주</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setWeekOffset((p) => p + 1)}>
          <Text style={styles.navText}>다음주 ▶</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={weekData}
        keyExtractor={(i) => i.date}
        renderItem={({ item }) => {
          const d = new Date(item.date);
          const dayName = KR_DAY[d.getDay()]; // ✅ 실제 요일
          return (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/daily?date=${item.date}`)}
              style={styles.row}
            >
              <Text style={styles.date}>{item.date} ({dayName})</Text>
              <Text style={styles.kcal}>{item.total} kcal</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const pink = "#FFD6E0"; const deepPink = "#FFB6C1";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#FF80A0", marginBottom: 15 },
  weekNav: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  navText: { color: deepPink, fontWeight: "600", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#fff",
    padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3 },
  date: { fontSize: 16, color: "#333" },
  kcal: { fontSize: 16, fontWeight: "600", color: "#FF7FA0" },
});
