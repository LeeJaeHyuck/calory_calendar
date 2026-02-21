import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { checkBadgeForDate } from "../../utils/badgeUtils";

const KR_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
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
    { empty?: boolean; date?: string; total?: number; sub?: number; weight?: number; exercise?: number; hasBadge?: boolean }[]
  >([]);
  const [settings, setSettings] = useState<any>(null);

  const [showTooltip, setShowTooltip] = useState(false);
  const [subKcal, setSubKcal] = useState<number>(0);
  const [totalIntakeFromStart, setTotalIntakeFromStart] = useState<number>(0);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  
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

      const { bmr, exercise, goalBurn, startDate } = settings;
      const normalize = (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const year = base.getFullYear();
      const month = base.getMonth();

      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);

      const startPad = (first.getDay() + 6) % 7;

      let arr: { empty?: boolean; date?: string; total?: number; sub?: number; weight?: number; exercise?: number; hasBadge?: boolean }[] = [];
      let totalSub = 0;
      let totalIntake = 0;

      // 다이어트 시작일 설정
      const dietStart = startDate ? new Date(startDate) : null;
      const nStart = dietStart !== null ? normalize(dietStart) : null;

      // 오늘 날짜 (시간 부분 제거)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ntoday = normalize(today);

      for (let i = 0; i < startPad; i++) arr.push({ empty: true });

      for (let day = 0; day <= last.getDate(); day++) {
        const d = new Date(year, month, day);
        const key = formatDate(d);
        const nd = normalize(d);

        const raw = await AsyncStorage.getItem(`meals-${key}`);
        let total = 0;

        if (raw) {
          const parsed = JSON.parse(raw);
          total = Object.values(parsed)
            .flat()
            .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
        }

        const weightRaw = await AsyncStorage.getItem(`weight-${key}`);
        let weight = 0;
        if (weightRaw) {
          weight = JSON.parse(weightRaw);
        }

        const exerciseRaw = await AsyncStorage.getItem(`exercise-${key}`);
        let dailyExercise = 0;
        if (exerciseRaw) {
          dailyExercise = JSON.parse(exerciseRaw);
        }

        // 뱃지 획득 여부 확인
        const hasBadge = await checkBadgeForDate(key);

        // ✔ 실제 소모량(todaySub) = total - (bmr + exercise + dailyExercise)
        const todaySub = total - (bmr + dailyExercise);
        
        if (nStart === null) {
          // 시작일이 설정되지 않았으면 오늘까지의 데이터만 포함
          if (nd <= ntoday && total > 0) {
            totalIntake += total;
            totalSub += todaySub;
          }
        } else {
          // 다이어트 시작일부터 오늘 날짜까지만 누적 계산
          if ((nd <= ntoday && nd >= nStart)) {
            totalIntake += total;
            totalSub += todaySub;
          }
        }

        arr.push({ date: key, total, sub: todaySub, weight, exercise: dailyExercise, hasBadge });
      }

      while (arr.length % 7 !== 0) arr.push({ empty: true });

      setCells(arr);
      setSubKcal(totalSub);
      setTotalIntakeFromStart(totalIntake);
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

 const bmr = settings?.bmr ?? 0;
  const intake = settings?.intake ?? 0;
  const exercise = settings?.exercise ?? 0;
  const startWeight = settings?.weight ?? 0;
  const goalWeight = settings?.targetWeight ?? 0;

  const dailyGoalSub = settings?.goalBurn ?? 0;

  const lostKg = (subKcal * -1) / kcalPerKg;
  const estWeight = (startWeight - lostKg).toFixed(1);

  const remainMidDays =
    subKcal > -7700
      ? Math.ceil((7700 + subKcal) / dailyGoalSub)
      : Math.ceil((7700 + (subKcal+7700)) / dailyGoalSub);

  const remainMidKcal =
      subKcal > -7700
        ? Math.ceil(7700 + subKcal)
        : Math.ceil(7700 + (subKcal + 7700));

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
          const weight = c.weight ?? 0;
          const exercise = c.exercise ?? 0;
          const hasRecord = total > 0;

          const displaySub = sub < 0 ? `${sub}` : `+${sub}`;

          // 시작일로부터 며칠째인지 계산
          let daysSinceStart = null;
          if (settings?.startDate && c.date) {
            const start = new Date(settings.startDate);
            const current = new Date(c.date);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
              daysSinceStart = diffDays + 1; // D+1부터 시작
            }
          }

          // -1kg 달성일 계산 (오늘 + remainMidDays)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const milestoneDate = new Date(today);
          milestoneDate.setDate(milestoneDate.getDate() + remainMidDays);

          // 목표 체중 달성일 계산 (오늘 + remainGoalDays)
          const goalDate = new Date(today);
          if (remainGoalDays !== null) {
            goalDate.setDate(goalDate.getDate() + remainGoalDays);
          }

          const cellDate = c.date ? new Date(c.date) : null;
          cellDate?.setHours(0, 0, 0, 0);

          const isMilestone = cellDate &&
            cellDate.getTime() === milestoneDate.getTime() &&
            remainMidDays > 0;

          const isGoal = cellDate &&
            remainGoalDays !== null &&
            cellDate.getTime() === goalDate.getTime() &&
            remainGoalDays > 0;

          // 총 섭취량 없으면 흰색
          const bg =
            !hasRecord
              ? "#ffffff"
              : sub <= -dailyGoalSub
              ? "#FF8FBF" // 목표 이하면 성공색
              : "#FFD6E7";

          const textColor =
            hasRecord && sub <= -dailyGoalSub ? "#ffffff" : "#FF4F84";

          return (
            <TouchableOpacity
              key={i}
              style={[styles.cell, { backgroundColor: bg }]}
              onPress={() => {
                if (isMilestone) {
                  setShowMilestoneModal(true);
                } else if (isGoal) {
                  setShowGoalModal(true);
                } else {
                  router.push(`/(tabs)/daily?date=${c.date}`);
                }
              }}
            >
              <View style={styles.dayRow}>
                <Text style={[styles.day, { color: textColor }]}>
                  {new Date(c.date!).getDate()}
                </Text>
                {/* 뱃지 획득한 경우 성공 아이콘 */}
                {c.hasBadge && (
                  <Text style={styles.successIcon}>✨</Text>
                )}
              </View>

              {/* -1kg 달성일 아이콘 */}
              {isMilestone && (
                <Text style={styles.milestoneIcon}>🎯</Text>
              )}

              {/* 목표 체중 달성일 아이콘 */}
              {isGoal && (
                <Text style={styles.milestoneIcon}>🏆</Text>
              )}

              {/* 시작일로부터 며칠째 */}
              {daysSinceStart !== null && (
                <Text style={[styles.dDay, { color: textColor }]}>
                  D+{daysSinceStart}
                </Text>
              )}

              {/* 총 섭취 */}
              {hasRecord && (
                <Text style={[styles.kcal, { color: textColor }]}>
                  {total} kcal
                </Text>
              )}

              {/* 그날 소모량 
              {hasRecord && (
                <Text
                  style={[styles.kcal, { color: "#4CAF50" }]}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {displaySub} kcal
                </Text>
              )}*/}

              {/* 몸무게 */}
              {weight > 0 && (
                <Text
                  style={[styles.kcal, { color: "#7C4DFF" }]}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  {weight} kg
                </Text>
              )}

              {/* 운동칼로리 */}
              {/* {exercise > 0 && (
                <Text
                  style={[styles.kcal, { color: "#FF9800" }]}
                  numberOfLines={1}
                  ellipsizeMode="clip"
                >
                  🏃 {exercise}
                </Text>
              )} */}

            </TouchableOpacity>
          );
        })} 
      </View>


      {/* REPORT BOX (원래 있던 기능 그대로 유지) */}
      <View style={styles.reportBox}>
        <View style={styles.reportHeaderRow}>
          <Text style={styles.reportHeader}>📊 {settings?.startDate ? "다이어트 시작일부터" : "월간"} 리포트</Text>
          <Pressable onPress={() => setShowTooltip(true)}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </Pressable>
        </View>

        {/* <View style={styles.reportItem}>
          <Text style={styles.reportLabel}>총 섭취 칼로리</Text>
          <Text style={styles.reportValue}>{totalIntakeFromStart} kcal</Text>
        </View> */}

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
          <Text style={styles.reportLabel}>-1kg까지 소모해야하는 칼로리</Text>
          <Text style={styles.reportValue}>
            {remainMidKcal !== null ? `${remainMidKcal}` : "-"}
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
              <Text style={styles.tooltipText}>
                • 총 섭취/소모 칼로리: {settings?.startDate ? "다이어트 시작일부터 현재까지" : "이번 달"} 누적 합계
              </Text>
              <Text style={styles.tooltipText}>• 예상 몸무게: 소비량 기반 자동 추정</Text>
              <Text style={styles.tooltipText}>• D-day: 목표까지 남은 예상 일수</Text>
              <Text style={styles.tooltipText}>⚖️ 1kg = 약 7,700kcal</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Milestone Modal */}
      <Modal
        transparent
        visible={showMilestoneModal}
        animationType="fade"
        onRequestClose={() => setShowMilestoneModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMilestoneModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.milestoneBox}>
              <Text style={styles.milestoneIcon}>🎯</Text>
              <Text style={styles.milestoneTitle}>-1kg 달성일</Text>
              <Text style={styles.milestoneSubtitle}>
                이 날짜는 현재 진행 상황을 기준으로{"\n"}
                1kg을 감량할 것으로 예상되는 날입니다!
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Goal Weight Modal */}
      <Modal
        transparent
        visible={showGoalModal}
        animationType="fade"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowGoalModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.milestoneBox}>
              <Text style={styles.milestoneIcon}>🏆</Text>
              <Text style={styles.milestoneTitle}>목표 체중 달성일</Text>
              <Text style={styles.milestoneSubtitle}>
                이 날짜는 현재 진행 상황을 기준으로{"\n"}
                목표 체중({goalWeight}kg)에 도달할 것으로{"\n"}
                예상되는 날입니다!
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

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
  dayRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  day: { fontWeight: "700", fontSize: 14 },
  successIcon: { fontSize: 10 },
  dDay: { fontSize: 8, fontWeight: "700", marginTop: 1 },
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
  milestoneIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  milestoneBox: {
    backgroundColor: "#FFF",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    maxWidth: "80%",
  },
  milestoneTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FF4F84",
    marginTop: 12,
    marginBottom: 8,
  },
  milestoneSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});
