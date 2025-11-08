import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KR_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const { width } = Dimensions.get("window");
const GAP = 2;
const CELL_SIZE = Math.floor((width - 2 * 10 - GAP * 6) / 7);
const kcalPerKg = 7700;

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function MonthlyScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cells, setCells] = useState<{ empty?: boolean; date?: string; total?: number }[]>([]);
  const [subKcal, setSubKcal] = useState<number>(0);
  const [settings, setSettings] = useState<any>(null);
  const router = useRouter();

  // ✅ 설정 불러오기
  const loadSettings = useCallback(async () => {
    const saved = await AsyncStorage.getItem("user-settings");
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  // ✅ 월별 데이터 로드
  const buildMonth = useCallback(
    async (base: Date) => {
      if (!settings) return;

      const { bmr, intake, exercise } = settings;
      const goalSubKcal = Math.max(1, bmr - intake + exercise);

      const year = base.getFullYear();
      const month = base.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);

      const startPad = (first.getDay() + 6) % 7;
      let sub = 0;
      const arr: { empty?: boolean; date?: string; total?: number }[] = [];

      for (let i = 0; i < startPad; i++) arr.push({ empty: true });

      for (let day = 1; day <= last.getDate(); day++) {
        const d = new Date(year, month, day);
        const key = formatDate(d);
        const raw = await AsyncStorage.getItem(`meals-${key}`);
        const total = raw
          ? Object.values(JSON.parse(raw))
              .flat()
              .reduce((s: number, m: any) => s + (m.kcal || 0), 0)
          : 0;
        arr.push({ date: key, total });
        if (total > 0) sub += bmr - total;
      }

      setSubKcal(sub);
      while (arr.length % 7 !== 0) arr.push({ empty: true });
      setCells(arr);
    },
    [settings]
  );

  // ✅ 탭 이동 시 자동 갱신
  useFocusEffect(
    useCallback(() => {
      loadSettings().then(() => buildMonth(currentMonth));
    }, [loadSettings, buildMonth, currentMonth])
  );

  // ✅ 계산
  const bmr = settings?.bmr || 0;
  const intake = settings?.intake || 0;
  const exercise = settings?.exercise || 0;
  const startWeight = settings?.weight || 0;
  const goalWeight = settings?.targetWeight || 0;
  const goalSubKcal = Math.max(1, bmr - intake + exercise);

  const lostKg = subKcal / kcalPerKg;
  const estWeight = (startWeight - lostKg).toFixed(1);
  const midWeight = (startWeight - 1).toFixed(1);

  const remainMidDays =
    parseFloat(estWeight) > parseFloat(midWeight)
      ? Math.ceil(((parseFloat(estWeight) - parseFloat(midWeight)) * kcalPerKg) / goalSubKcal)
      : 0;

  const remainGoalDays =
    parseFloat(estWeight) > parseFloat(goalWeight)
      ? Math.ceil(((parseFloat(estWeight) - parseFloat(goalWeight)) * kcalPerKg) / goalSubKcal)
      : 0;

  const changeMonth = (off: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + off);
    setCurrentMonth(d);
  };

  const colorOf = (k: number = 0) => {
    if (k === 0) return "#fff";
    if (k <= intake) return "#FFE4EC";
    if (k < 1800) return "#F8BBD0";
    return "#F48FB1";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Text style={styles.nav}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Text style={styles.nav}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {KR_WEEK.map((w) => (
          <Text key={w} style={styles.weekItem}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c, i) => (
          <TouchableOpacity
            key={i}
            disabled={c.empty}
            style={[styles.cell, { backgroundColor: c.empty ? "transparent" : colorOf(c.total!) }]}
            onPress={() => c.date && router.push(`/(tabs)/daily?date=${c.date}`)}
          >
            {!c.empty && (
              <>
                <Text style={styles.day}>{new Date(c.date!).getDate()}</Text>
                {c.total! > 0 && <Text style={styles.kcal}>{c.total} kcal</Text>}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* 📊 Report */}
      <Text style={styles.reportHeader}>📊 Report</Text>
      <Text style={styles.reportLine}>총 소모 칼로리: -{subKcal} kcal</Text>
      <Text style={styles.reportLine}>예상 몸무게: {estWeight} kg</Text>
      <Text style={styles.reportLine}>{midWeight} kg 까지: D-{remainMidDays}</Text>
      <Text style={styles.reportLine}>{goalWeight} kg 까지: D-{remainGoalDays}</Text>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", paddingHorizontal: 10, paddingTop: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  nav: { fontSize: 20, color: "#FF7FA0", fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", color: "#FF80A0" },
  weekHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  weekItem: { width: CELL_SIZE, textAlign: "center", color: "#FF7FA0", fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", columnGap: GAP, rowGap: GAP },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  day: { fontWeight: "700", color: "#333", fontSize: 14 },
  kcal: { fontSize: 10, color: "#FF7FA0", fontWeight: "600" },
  reportHeader: {
    marginTop: 25,
    marginBottom: 10,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: "#FF4F84",
    borderBottomWidth: 2,
    borderBottomColor: "#FFD6E0",
    paddingBottom: 4,
  },
  reportLine: {
    textAlign: "center",
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    marginBottom: 4,
  },
});
