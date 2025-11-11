import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
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
  const [showTooltip, setShowTooltip] = useState(false);
  const router = useRouter();

  // ✅ 설정 불러오기
  const loadSettings = useCallback(async () => {
    const saved = await AsyncStorage.getItem("user-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
    } else {
      setSettings(null); // 설정이 전혀 없을 때도 null 허용
    }
  }, []);

  // ✅ 월별 데이터 로드
  const buildMonth = useCallback(
    async (base: Date) => {
      const safeSettings = settings ?? {
        bmr: 0,
        intake: 0,
        exercise: 0,
      };

      const { bmr, intake, exercise } = safeSettings;
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
        if (total > 0 && bmr > 0) sub += bmr - total;
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

  // ✅ 계산 (값 없으면 - 처리)
  const bmr = settings?.bmr ?? null;
  const intake = settings?.intake ?? null;
  const exercise = settings?.exercise ?? null;
  const startWeight = settings?.weight ?? null;
  const goalWeight = settings?.targetWeight ?? null;
  const goalSubKcal = bmr && intake ? Math.max(1, bmr - intake + (exercise ?? 0)) : null;

  const lostKg = subKcal / kcalPerKg;
  const estWeight =
    startWeight && !isNaN(lostKg)
      ? (startWeight - lostKg).toFixed(1)
      : null;
  const midWeight =
    startWeight ? (Math.max(startWeight - 1, 0)).toFixed(1) : null;

  const remainMidDays =
    estWeight && midWeight && goalSubKcal
      ? Math.ceil(((parseFloat(estWeight) - parseFloat(midWeight)) * kcalPerKg) / goalSubKcal)
      : null;

  const remainGoalDays =
    estWeight && goalWeight && goalSubKcal
      ? Math.ceil(((parseFloat(estWeight) - parseFloat(goalWeight)) * kcalPerKg) / goalSubKcal)
      : null;

  const changeMonth = (off: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + off);
    setCurrentMonth(d);
  };

  const colorOf = (k: number = 0) => {
    if (k === 0) return "#fff";
    if (intake && k <= intake) return "#FFE4EC";
    if (k < 1800) return "#F8BBD0";
    return "#F48FB1";
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 📅 헤더 */}
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

      {/* 🗓️ 요일 */}
      <View style={styles.weekHeader}>
        {KR_WEEK.map((w) => (
          <Text key={w} style={styles.weekItem}>
            {w}
          </Text>
        ))}
      </View>

      {/* 📆 달력 */}
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
      <View style={styles.reportHeaderRow}>
        <Text style={styles.reportHeader}>📊 Report</Text>
        <Pressable onPress={() => setShowTooltip(true)}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </Pressable>
      </View>

      <Text style={styles.reportLine}>
        총 소모 칼로리: {subKcal ? `-${subKcal} kcal` : "-"}
      </Text>
      <Text style={styles.reportLine}>
        예상 몸무게: {estWeight ? `${estWeight} kg` : "-"}
      </Text>
      <Text style={styles.reportLine}>
        {midWeight && remainMidDays !== null
          ? `${midWeight} kg 까지: D-${remainMidDays}`
          : "-"}
      </Text>
      <Text style={styles.reportLine}>
        {goalWeight && remainGoalDays !== null
          ? `${goalWeight} kg 까지: D-${remainGoalDays}`
          : "-"}
      </Text>

      {/* 🗨️ Report 툴팁 모달 */}
      <Modal
        transparent
        visible={showTooltip}
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTooltip(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipText}>📊 Report 설명</Text>
              <Text style={styles.tooltipText}>
                • 총 소모 칼로리: 한달 동안 소비한 칼로리의 합계예요.{"\n"}
                • 예상 몸무게: 지금까지의 데이터를 기반으로 계산된 추정치예요.{"\n"}
                • -1kg D-day: 1kg이 빠지는 날까지 남은 예상 일수예요.{"\n"}
                • 목표 D-day: 목표 몸무게까지 남은 예상 일수예요.{"\n"}
                ⚖️ 참고: 체중 1kg은 약 7,700kcal에 해당해요.
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  reportHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  infoIcon: {
    fontSize: 18,
    color: "#9AA0A6",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipBox: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 12,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tooltipText: {
    color: "#333",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
  },
  
});
