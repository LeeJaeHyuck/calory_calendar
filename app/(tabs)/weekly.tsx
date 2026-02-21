import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KR_DAY = ["일", "월", "화", "수", "목", "금", "토"];
const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// ✅ 월요일 기준 주차 계산
const getWeekOfMonthMonday = (date: Date) => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = firstOfMonth.getDay();
  const offsetToMonday = (8 - day) % 7;
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(firstOfMonth.getDate() + offsetToMonday);
  if (date < firstMonday) return 1;
  const diffDays = Math.floor(
    (date.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24)
  );
  return 1 + Math.floor(diffDays / 7);
};

type MealInfo = {
  total: number;
  items: { name: string; kcal: number }[];
};

type WeekRow = {
  date: string;
  breakfast: MealInfo;
  lunch: MealInfo;
  dinner: MealInfo;
  total: number;
  weight: number;
  exercise: number;
  photos: { uri: string; timestamp: string }[];
};

export default function WeeklyScreen() {
  const [weekData, setWeekData] = useState<WeekRow[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"all" | "photos" | "calories">("all");
  const [bmr, setBmr] = useState(0);
  const [goalBurn, setGoalBurn] = useState(0);
  const router = useRouter();

  const safeMeal = (maybeArr: any): MealInfo => {
    if (!Array.isArray(maybeArr)) return { total: 0, items: [] };
    const items: { name: string; kcal: number }[] = [];
    let total = 0;
    for (const item of maybeArr) {
      const kcal = Number(item?.kcal);
      const name = item?.name || "";
      if (!Number.isNaN(kcal)) {
        total += kcal;
        if (name || kcal > 0) items.push({ name, kcal });
      }
    }
    return { total, items };
  };

  const loadWeeklyData = useCallback(async () => {
    // 설정에서 뷰 모드 및 BMR, goalBurn 불러오기
    try {
      const settings = await AsyncStorage.getItem("user-settings");
      if (settings) {
        const parsed = JSON.parse(settings);
        setViewMode(parsed.weeklyViewMode || "all");
        setBmr(parsed.bmr || 0);
        setGoalBurn(parsed.goalBurn || 0);
      }
    } catch (e) {
      console.error("Failed to load view mode:", e);
    }

    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const day = base.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - diffToMonday);

    const results: WeekRow[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDate(d);

      let breakfast: MealInfo = { total: 0, items: [] };
      let lunch: MealInfo = { total: 0, items: [] };
      let dinner: MealInfo = { total: 0, items: [] };
      let weight = 0;
      let exercise = 0;
      let photos: { uri: string; timestamp: string }[] = [];

      try {
        const raw = await AsyncStorage.getItem(`meals-${dateStr}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          breakfast = safeMeal(parsed?.Breakfast);
          lunch = safeMeal(parsed?.Lunch);
          dinner = safeMeal(parsed?.Dinner);
        }

        const weightRaw = await AsyncStorage.getItem(`weight-${dateStr}`);
        if (weightRaw) {
          weight = JSON.parse(weightRaw);
        }

        const exerciseRaw = await AsyncStorage.getItem(`exercise-${dateStr}`);
        if (exerciseRaw) {
          exercise = JSON.parse(exerciseRaw);
        }

        const photosRaw = await AsyncStorage.getItem(`photos-${dateStr}`);
        if (photosRaw) {
          photos = JSON.parse(photosRaw);
        }
      } catch {
        breakfast = { total: 0, items: [] };
        lunch = { total: 0, items: [] };
        dinner = { total: 0, items: [] };
        weight = 0;
        exercise = 0;
        photos = [];
      }

      const total = breakfast.total + lunch.total + dinner.total;
      results.push({ date: dateStr, breakfast, lunch, dinner, total, weight, exercise, photos });
    }

    setWeekData(results);
  }, [weekOffset]);

  useFocusEffect(
    useCallback(() => {
      loadWeeklyData();
    }, [loadWeeklyData])
  );

  const goPrevWeek = () => setWeekOffset((p) => p - 1);
  const goNextWeek = () => setWeekOffset((p) => p + 1);
  const goThisWeek = () => setWeekOffset(0);


  // ✅ 헤더용 주차 텍스트
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  const weekOfMonth = getWeekOfMonthMonday(refDate);
  const yy = String(refDate.getFullYear()).slice(2);
  const mm = String(refDate.getMonth() + 1).padStart(2, "0");
  const headerTitle = `🍰 ${yy}년 ${mm}월 ${weekOfMonth}주차`;

  const renderMealBox = (meal: MealInfo, isPastDate: boolean) => (
    <View style={styles.mealBox}>
      {/* 전체 합계 */}
      <Text style={[styles.mealTotal, isPastDate && { color: "#B0B0B0" }]}>
        {meal.total ? `${meal.total} kcal` : "-"}
      </Text>

      {meal.items.length > 0 && <View style={styles.divider} />}

      {/* 메뉴 & 칼로리 세로 구조 */}
      {meal.items.length > 0 ? (
        meal.items.map((f, i) => (
          <View key={i} style={styles.mealItemGroup}>
            <Text style={[styles.mealItemName, isPastDate && { color: "#999" }]}>{f.name || "(이름없음)"}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.mealItemEmpty, isPastDate && { color: "#CCC" }]}>기록 없음</Text>
      )}
    </View>
  );

  const renderHeader = () => {
    // 사진만 보기 모드
    if (viewMode === "photos") {
      return (
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.dateCell, styles.headerText]}>
            날짜
          </Text>
          <Text style={[styles.cell, styles.photoCell, styles.headerText]}>
            식단 사진
          </Text>
        </View>
      );
    }

    // 칼로리+몸무게 모드
    if (viewMode === "calories") {
      return (
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.dateCell, styles.headerText]}>
            날짜
          </Text>
          <Text style={[styles.cell, styles.calorieInfoCell, styles.headerText]}>
            순소모
          </Text>
          <Text style={[styles.cell, styles.calorieInfoCell, styles.headerText]}>
            몸무게
          </Text>
        </View>
      );
    }

    // 전체 보기 모드 (기본)
    return (
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.dateCell, styles.headerText]}>
          날짜
        </Text>
        <Text style={[styles.cell, styles.mealCell, styles.headerText]}>
          아침
        </Text>
        <Text style={[styles.cell, styles.mealCell, styles.headerText]}>
          점심
        </Text>
        <Text style={[styles.cell, styles.mealCell, styles.headerText]}>
          저녁
        </Text>
        {/* <Text style={[styles.cell, styles.weightCell, styles.headerText]}>
          몸무게
        </Text> */}
        {/* <Text style={[styles.cell, styles.weightCell, styles.headerText]}>
          운동
        </Text> */}
      </View>
    );
  };

  const renderItem = ({ item }: { item: WeekRow }) => {
    const d = new Date(item.date);
    const dayName = KR_DAY[d.getDay()];
    const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
      d.getDate()
    ).padStart(2, "0")} (${dayName})`;

    // 지난 날짜 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(item.date);
    itemDate.setHours(0, 0, 0, 0);
    const isPastDate = itemDate < today;

    // 사진만 보기 모드
    if (viewMode === "photos") {
      return (
        <TouchableOpacity
          onPress={() => router.push(`/(tabs)/daily?date=${item.date}`)}
          style={[styles.row, styles.dataRow]}
          activeOpacity={0.85}
        >
          <View style={[styles.cell, styles.dateCell]}>
            <Text style={styles.dateText}>{label}</Text>
          </View>

          <View style={[styles.cell, styles.photoCell]}>
            {item.photos.length > 0 ? (
              <View style={styles.photoGridInWeekly}>
                {item.photos.slice(0, 3).map((photo, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: photo.uri }}
                    style={styles.photoThumbnail}
                  />
                ))}
                {item.photos.length > 3 && (
                  <View style={styles.morePhotosOverlay}>
                    <Text style={styles.morePhotosText}>+{item.photos.length - 3}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.mealItemEmpty}>사진 없음</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    // 칼로리+몸무게 모드
    // if (viewMode === "calories") {
    //   // 순소모 = BMR - 섭취 + 운동
    //   const netBurn = bmr - item.total + item.exercise;
    //   const netBurnColor = netBurn >= 0 ? "#4CAF50" : "#FF6B6B";

    //   return (
    //     <TouchableOpacity
    //       onPress={() => router.push(`/(tabs)/daily?date=${item.date}`)}
    //       style={[styles.row, styles.dataRow]}
    //       activeOpacity={0.85}
    //     >
    //       <View style={[styles.cell, styles.dateCell]}>
    //         <Text style={styles.dateText}>{label}</Text>
    //       </View>

    //       <View style={[styles.cell, styles.calorieInfoCell]}>
    //         <Text style={[styles.netBurnText, { color: netBurnColor }]}>
    //           {netBurn ? `${netBurn > 0 ? '+' : ''}${netBurn} kcal` : "-"}
    //         </Text>
    //       </View>

    //       <View style={[styles.cell, styles.calorieInfoCell]}>
    //         <Text style={styles.weightText}>
    //           {item.weight ? `${item.weight} kg` : "-"}
    //         </Text>
    //       </View>
    //     </TouchableOpacity>
    //   );
    // }

    // 전체 보기 모드 (기본)
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(tabs)/daily?date=${item.date}`)}
        style={[styles.row, styles.dataRow]}
        activeOpacity={0.85}
      >
        <View style={[styles.cell, styles.dateCell]}>
          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, isPastDate && { color: "#999" }]}>{label}</Text>
            {item.exercise >= goalBurn && goalBurn > 0 && (
              <Text style={styles.successIcon}>✨</Text>
            )}
          </View>
          <Text style={[styles.totalUnderDate, isPastDate && { color: "#B0B0B0" }]}>
            {item.total ? `${item.total} kcal` : "-"}
          </Text>
          <Text style={[styles.exerciseText, isPastDate && { color: "#90C090" }]}>
            {item.weight ? `${item.weight} kg` : "-"}
          </Text>
        </View>

        <View style={[styles.cell, styles.mealCell]}>
          {renderMealBox(item.breakfast, isPastDate)}
        </View>
        <View style={[styles.cell, styles.mealCell]}>
          {renderMealBox(item.lunch, isPastDate)}
        </View>
        <View style={[styles.cell, styles.mealCell]}>
          {renderMealBox(item.dinner, isPastDate)}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goPrevWeek}>
            <Text style={styles.navBtn}>◀</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{headerTitle}</Text>

          <TouchableOpacity onPress={goNextWeek}>
            <Text style={styles.navBtn}>▶</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goThisWeek} style={styles.todayButton}>
          <Text style={styles.todayText}>이번주로 이동</Text>
        </TouchableOpacity>

      <ScrollView style={styles.tableWrapper} contentContainerStyle={{ paddingBottom: 20 }}>
        {renderHeader()}
        <FlatList
          data={weekData}
          keyExtractor={(i) => i.date}
          renderItem={renderItem}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>이번 주 기록이 없어요.</Text>
            </View>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FF80A0",
  },

  weekNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  navText: {
    color: deepPink,
    fontWeight: "700",
    fontSize: 18, // ✅ 기존 16 → 18로 키움
  },
  weekTitle: { fontSize: 22, fontWeight: "700", color: "#FF80A0" },

  tableWrapper: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, paddingHorizontal: 6 },
  cell: { flex: 1 },

  headerRow: { backgroundColor: pink, borderRadius: 10, marginBottom: 6 },
  headerText: { fontWeight: "700", color: "#FF4F84", textAlign: "center" },

  dateCell: { flex: 0.9, alignItems: "flex-start" },
  mealCell: { flex: 1 },
  weightCell: { flex: 0.6, alignItems: "center", justifyContent: "center" },
  weightText: { color: "#FF7FA0", fontWeight: "700", fontSize: 13 },
  exerciseText: { color: "#4CAF50", fontWeight: "700", fontSize: 13 },
  dataRow: { backgroundColor: "#FFF", borderRadius: 10 },

  dateHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { color: "#333", fontWeight: "600" },
  successIcon: { fontSize: 14, marginLeft: 2 },
  totalUnderDate: { color: "#FF7FA0", fontWeight: "700", fontSize: 13, marginTop: 2 },

  mealBox: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  mealTotal: { fontWeight: "700", color: "#FF7FA0", fontSize: 13, marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#FFD6E0", alignSelf: "stretch", marginVertical: 2 },
  mealItem: { fontSize: 12, color: "#444" },
  mealItemEmpty: { fontSize: 12, color: "#aaa" },

  separator: { height: 6 },
  emptyBox: { paddingVertical: 18, alignItems: "center" },
  emptyText: { color: "#9AA0A6" },

  todayButton: {
    backgroundColor: deepPink,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
  },

  todayText: { color: "#fff", fontWeight: "600" },
  mealItemGroup: {
    alignItems: "center", // 중앙 정렬
    marginBottom: 4, // 각 항목 간 여백
  },
  
  mealItemName: {
    fontSize: 12,
    color: "#444",
    fontWeight: "500",
  },
  
  mealItemKcal: {
    fontSize: 11,
    color: "#FF7FA0", // ✅ 칼로리 색상 강조
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  navBtn: {
    fontSize: 28,
    color: "#FF7FA0",
    fontWeight: "600",
  },

  // 사진 보기 모드 스타일
  photoCell: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  photoGridInWeekly: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  photoThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  morePhotosOverlay: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  morePhotosText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // 칼로리+몸무게 모드 스타일
  calorieInfoCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calorieText: {
    color: "#FF7FA0",
    fontWeight: "700",
    fontSize: 14,
  },
  netBurnText: {
    fontWeight: "700",
    fontSize: 14,
  },
});
