import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KR_WEEK = ["월", "화", "수", "목", "금", "토", "일"];
const { width } = Dimensions.get("window");
const GAP = 2;
const CELL_SIZE = Math.floor((width - 20 - GAP * 6) / 7);
const kcalPerKg = 7700;

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function MonthlyScreen() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cells, setCells] = useState<
    { empty?: boolean; date?: string; total?: number; sub?: number }[]
  >([]);
  const [settings, setSettings] = useState<any>(null);

  const [showTooltip, setShowTooltip] = useState(false);
  const [subKcal, setSubKcal] = useState<number>(0);
  
  const displaysubKcal = subKcal < 0 ? `${subKcal}` : `+${subKcal}`;

  // ⚙️ Setting 로드
  const loadSettings = useCallback(async () => {
    const saved = await AsyncStorage.getItem("user-settings");
    if (saved) setSettings(JSON.parse(saved));
    else
      setSettings({
        weight: 0,
        targetWeight: 0,
        bmr: 0,
        intake: 0,
        exercise: 0,
        goalBurn: 0,
      });
  }, []);

  // ✔ Month 생성
  const buildMonth = useCallback(
    async (base: Date) => {
      if (!settings) return;

      const { bmr, exercise, goalBurn } = settings;

      const year = base.getFullYear();
      const month = base.getMonth();

      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);

      const startPad = (first.getDay() + 6) % 7;

      let arr: { empty?: boolean; date?: string; total?: number; sub?: number }[] = [];
      let totalSub = 0;

      for (let i = 0; i < startPad; i++) arr.push({ empty: true });

      for (let day = 1; day <= last.getDate(); day++) {
        const d = new Date(year, month, day);
        const key = formatDate(d);

        const raw = await AsyncStorage.getItem(`meals-${key}`);
        let total = 0;

        if (raw) {
          const parsed = JSON.parse(raw);
          total = Object.values(parsed)
            .flat()
            .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
        }

        // ✔ 실제 소모량(todaySub) = goalBurn - total
        const todaySub = total - (bmr + exercise);

        if (total > 0) totalSub += todaySub;

        arr.push({ date: key, total, sub: todaySub });
      }

      while (arr.length % 7 !== 0) arr.push({ empty: true });

      setCells(arr);
      setSubKcal(totalSub);
    },
    [settings]
  );

  // 탭 진입 시 Setting 로드
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  // Setting 로드 후 월 렌더링
  useFocusEffect(
    useCallback(() => {
      if (settings) buildMonth(currentMonth);
    }, [settings, currentMonth])
  );

  // 목표 체중 계산 (기존 Monthly 기능 유지)
  const bmr = settings?.bmr ?? 0;
  const intake = settings?.intake ?? 0;
  const exercise = settings?.exercise ?? 0;
  const startWeight = settings?.weight ?? 0;
  const goalWeight = settings?.targetWeight ?? 0;

  const dailyGoalSub = settings?.goalBurn ?? 0;

  const lostKg = (subKcal * -1) / kcalPerKg;
  const estWeight = (startWeight - lostKg).toFixed(1);

  const remainMidDays =
    dailyGoalSub > 0
      ? Math.ceil((1 * kcalPerKg) / dailyGoalSub)
      : null;

  const remainGoalDays =
    dailyGoalSub > 0
      ? Math.ceil(((estWeight - Number(goalWeight)) * kcalPerKg) / dailyGoalSub)
      : null;

  const changeMonth = (off: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + off);
    setCurrentMonth(d);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* MONTH HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Text style={styles.navBtn}>◀</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          🍔 {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
        </Text>

        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Text style={styles.navBtn}>▶</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => setCurrentMonth(new Date())}
        style={styles.todayButton}
      >
        <Text style={styles.todayText}>이번달로 이동</Text>
      </TouchableOpacity>

      {/* 요일 */}
      <View style={styles.weekHeader}>
        {KR_WEEK.map((w) => (
          <Text key={w} style={styles.weekItem}>
            {w}
          </Text>
        ))}
      </View>

      {/* CALENDAR GRID */}
      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (c.empty) {
            return (
              <View
                key={i}
                style={[styles.cell, { backgroundColor: "transparent" }]}
              />
            );
          }

          // ✅ undefined 대비해서 기본값 깔기
          const total = c.total ?? 0;
          const sub = c.sub ?? 0;
          const hasRecord = total > 0;

          const displaySub = sub < 0 ? `${sub}` : `+${sub}`;


          // 총 섭취량 없으면 흰색
          const bg =
            !hasRecord
              ? "#ffffff"
              : total <= intake
              ? "#FF8FBF" // 목표 이하면 성공색
              : "#FFD6E7";

          const textColor =
            hasRecord && total <= intake ? "#ffffff" : "#FF4F84";

          return (
            <TouchableOpacity
              key={i}
              style={[styles.cell, { backgroundColor: bg }]}
              onPress={() => router.push(`/(tabs)/daily?date=${c.date}`)}
            >
              <Text style={[styles.day, { color: textColor }]}>
                {new Date(c.date!).getDate()}
              </Text>

              {/* 총 섭취 */}
              {hasRecord && (
                <Text style={[styles.kcal, { color: textColor }]}>
                  {total} kcal
                </Text>
              )}

              {/* 그날 소모량 */}
              {hasRecord && (
                <Text
                  style={[styles.kcal, { color: "#7C4DFF" }]}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {displaySub} kcal
                </Text>
              )}

            </TouchableOpacity>
          );
        })}
      </View>


      {/* REPORT BOX (원래 있던 기능 그대로 유지) */}
      <View style={styles.reportBox}>
        <View style={styles.reportHeaderRow}>
          <Text style={styles.reportHeader}>📊 월간 리포트</Text>
          <Pressable onPress={() => setShowTooltip(true)}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </Pressable>
        </View>

        <View style={styles.reportItem}>
          <Text style={styles.reportLabel}>총 소모 칼로리</Text>
          <Text style={styles.reportValue}>{displaysubKcal} kcal</Text>
        </View>

        <View style={styles.reportItem}>
          <Text style={styles.reportLabel}>예상 몸무게</Text>
          <Text style={styles.reportValue}>
            {isNaN(Number(estWeight)) ? "-" : `${estWeight} kg`}
          </Text>
        </View>

        <View style={styles.reportItem}>
          <Text style={styles.reportLabel}>-1kg 예상일</Text>
          <Text style={styles.reportValue}>
            {remainMidDays !== null ? `D-${remainMidDays}` : "-"}
          </Text>
        </View>

        <View style={styles.reportItem}>
          <Text style={styles.reportLabel}>목표 체중 예상일</Text>
          <Text style={styles.reportValue}>
            {remainGoalDays !== null ? `D-${remainGoalDays}` : "-"}
          </Text>
        </View>
      </View>

      {/* Tooltip */}
      <Modal
        transparent
        visible={showTooltip}
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTooltip(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipTitle}>📊 Report 설명</Text>
              <Text style={styles.tooltipText}>• 총 소모 칼로리: 한 달간 실제 소비량 합계</Text>
              <Text style={styles.tooltipText}>• 예상 몸무게: 소비량 기반 자동 추정</Text>
              <Text style={styles.tooltipText}>• D-day: 목표까지 남은 예상 일수</Text>
              <Text style={styles.tooltipText}>⚖️ 1kg = 약 7,700kcal</Text>
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
  navBtn: { fontSize: 28, color: "#FF7FA0", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#FF80A0" },

  weekHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  weekItem: { width: CELL_SIZE, textAlign: "center", color: "#FF7FA0", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },

  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  day: { fontWeight: "700", fontSize: 14 },
  kcal: { fontSize: 10, fontWeight: "700", marginTop: 2 },

  // Report Box
  reportBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  reportHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reportHeader: { fontSize: 20, fontWeight: "700", color: "#FF4F84" },
  infoIcon: { fontSize: 18, color: "#9AA0A6" },

  reportItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reportLabel: { fontSize: 16, fontWeight: "600", color: "#555" },
  reportValue: { fontSize: 16, fontWeight: "700", color: "#FF7FA0" },

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
  },
  tooltipTitle: {
    color: "#FF4F84",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  tooltipText: { color: "#333", fontSize: 15, lineHeight: 21, marginBottom: 4 },
  todayButton: {
    backgroundColor: "#FFB6C1",
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  todayText: {
    color: "#fff",
    fontWeight: "600",
  },
});
