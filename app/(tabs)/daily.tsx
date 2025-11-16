import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { default as React, useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Meal {
  name: string;
  kcal: number;
}
interface Meals {
  Breakfast: Meal[];
  Lunch: Meal[];
  Dinner: Meal[];
}

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function DailyScreen() {
  // ⚙️ Setting에서 가져오는 값들 (이제 goalBurn만 사용)
  const [bmr, setBmr] = useState(1100);
  const [goalBurn, setGoalBurn] = useState(0); // 🔥 목표 소모 칼로리
  const [exercise, setExercise] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setBmr(parsed.bmr || 1100);
          setGoalBurn(parsed.goalBurn || 0); // 🔥 저장된 goalBurn만 가져옴
        }
      })();
    }, [])
  );

  const KR_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  const formatKoreanDate = (date: Date) => {
    const year = String(date.getFullYear()).slice(2);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekLabel = KR_WEEK[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekLabel})`;
  };

  const params = useLocalSearchParams();
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [meals, setMeals] = useState<Meals>({
    Breakfast: [{ name: "", kcal: 0 }],
    Lunch: [{ name: "", kcal: 0 }],
    Dinner: [{ name: "", kcal: 0 }],
  });
  const [isSaved, setIsSaved] = useState(false);
  const [showTooltip, setShowTooltip] = useState<null | "intake" | "burn">(null);

  // 날짜 이동 시 데이터 불러오기
  useFocusEffect(
    useCallback(() => {
      if (params?.date) setDate(String(params.date));
    }, [params?.date])
  );

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(`meals-${date}`);
      if (saved) setMeals(JSON.parse(saved));
      else {
        setMeals({
          Breakfast: [{ name: "", kcal: 0 }],
          Lunch: [{ name: "", kcal: 0 }],
          Dinner: [{ name: "", kcal: 0 }],
        });
      }
      setIsSaved(false);
    })();
  }, [date]);

  // 앱 재진입 시 최신 goalBurn/bmr 로드
  useEffect(() => {
    const reloadOnFocus = async () => {
      const saved = await AsyncStorage.getItem("user-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setBmr(parsed.bmr || 0);
        setGoalBurn(parsed.goalBurn || 0);
        setExercise(parsed.exercise || 0);
      }
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reloadOnFocus();
    });
    return () => sub.remove();
  }, []);

  // 음식 업데이트
  const updateMeal = (
    type: keyof Meals,
    index: number,
    key: keyof Meal,
    value: string
  ) => {
    const updated = { ...meals };
    updated[type] = [...updated[type]];
    updated[type][index] = { ...updated[type][index] };

    if (key === "kcal") updated[type][index][key] = parseInt(value) || 0;
    else updated[type][index][key] = value;

    setMeals(updated);
    setIsSaved(false);
  };

  // 음식 추가/삭제
  const addMeal = (type: keyof Meals) => {
    const updated = { ...meals };
    updated[type].push({ name: "", kcal: 0 });
    setMeals(updated);
    setIsSaved(false);
  };

  const removeMeal = (type: keyof Meals, index: number) => {
    const updated = { ...meals };
    updated[type].splice(index, 1);
    setMeals(updated);
    setIsSaved(false);
  };

  // 총 섭취 kcal
  const total = Object.values(meals)
    .flat()
    .reduce((s, m) => s + (m.kcal || 0), 0);

  // 실제 소모량 = BMR - 섭취량
  const subKcal = bmr + exercise - total;

  // 저장
  const saveMeals = async () => {
    await AsyncStorage.setItem(`meals-${date}`, JSON.stringify(meals));
    setIsSaved(true);

    // 목표 달성 여부 계산
    if (subKcal >= goalBurn) {
      Alert.alert("참 잘했어요! 🎉", "오늘 목표를 달성했습니다!");
    } else {
      const diff = goalBurn - subKcal;
      Alert.alert("조금만 더 힘내세요! 💪", `목표까지 ${diff} kcal 남았어요!`);
    }
  };

  const changeDay = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(formatDate(d));
  };

  const goToday = () => setDate(formatDate(new Date()));

  const renderMeal = (type: keyof Meals) => {
    const mealFoods = meals[type];
    const mealTotal = mealFoods.reduce((sum, f) => sum + (f.kcal || 0), 0);

    return (
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealTitle}>{type}</Text>
          <Text style={styles.mealTotal}>{mealTotal} kcal</Text>
        </View>

        {mealFoods.map((m, i) => (
          <View key={i} style={styles.foodRow}>
            <TextInput
              style={styles.foodInput}
              placeholder="음식 이름"
              value={m.name}
              onChangeText={(v) => updateMeal(type, i, "name", v)}
            />
            <TextInput
              style={styles.kcalInput}
              placeholder="kcal"
              keyboardType="numeric"
              value={m.kcal ? String(m.kcal) : ""}
              onChangeText={(v) => updateMeal(type, i, "kcal", v)}
            />
            <TouchableOpacity onPress={() => removeMeal(type, i)}>
              <Text style={styles.delete}>×</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => addMeal(type)}
          style={styles.addButton}
        >
          <Text style={styles.addText}>+ 추가</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => changeDay(-1)}>
            <Text style={styles.navBtn}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🍓 {formatKoreanDate(new Date(date))}</Text>

          <TouchableOpacity onPress={() => changeDay(1)}>
            <Text style={styles.navBtn}>▶</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToday} style={styles.todayButton}>
          <Text style={styles.todayText}>오늘로 이동</Text>
        </TouchableOpacity>

        <FlatList
          data={Object.keys(meals) as (keyof Meals)[]}
          renderItem={({ item }) => renderMeal(item)}
          keyExtractor={(item) => item}
        />

        {/* 하단 계산 결과 */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            onPress={saveMeals}
            style={[
              styles.saveButton,
              isSaved && { backgroundColor: "#F8BBD0" },
            ]}
          >
            <Text style={styles.saveText}>
              {isSaved ? "✅ 저장됨" : "💾 저장하기"}
            </Text>
          </TouchableOpacity>

          <View>
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.total,
                  total >= 999999 ? { color: "#FF6B6B" } : {},
                ]}
              >
                총 섭취 칼로리: {total} kcal
              </Text>
              <Pressable onPress={() => setShowTooltip("intake")}>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </Pressable>
            </View>

            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.total,
                  subKcal < goalBurn && { color: "#FF6B6B" },
                ]}
              >
                총 소모 칼로리: {subKcal} kcal
              </Text>
              <Pressable onPress={() => setShowTooltip("burn")}>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 툴팁 */}
        <Modal
          transparent
          visible={!!showTooltip}
          animationType="fade"
          onRequestClose={() => setShowTooltip(null)}
        >
          <TouchableWithoutFeedback onPress={() => setShowTooltip(null)}>
            <View style={styles.modalOverlay}>
              {showTooltip && (
                <View style={styles.tooltipBox}>
                  <Text style={styles.tooltipText}>
                    {showTooltip === "intake"
                      ? "하루 동안 섭취한 모든 음식의 총 칼로리 합계예요."
                      : "기초대사량 + 운동칼로리 - 섭취 칼로리로 계산된 실제 소모 칼로리예요."}
                  </Text>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  navBtn: { fontSize: 28, color: "#FF7FA0", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#FF80A0" },
  todayButton: {
    backgroundColor: deepPink,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  todayText: { color: "#fff", fontWeight: "600" },
  mealSection: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  mealTitle: { fontSize: 18, fontWeight: "600", color: "#FF7FA0" },
  mealTotal: { fontSize: 16, fontWeight: "600", color: "#FF7FA0" },
  foodRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  foodInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: "#FFD6E0",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
    marginRight: 6,
  },
  kcalInput: {
    width: 70,
    borderWidth: 1,
    borderColor: "#FFD6E0",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
    marginRight: 6,
  },
  delete: { fontSize: 20, color: "#FF9AB5" },
  addButton: {
    backgroundColor: pink,
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 5,
    width: 80,
  },
  addText: { color: "#FF6295", fontWeight: "600" },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  total: {
    fontSize: 14,
    fontWeight: "700",
    color: "#77a4f8ff",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  infoIcon: {
    marginLeft: 8,
    fontSize: 16,
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
    padding: 15,
    borderRadius: 12,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  tooltipText: {
    color: "#333",
    fontSize: 15,
    lineHeight: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: deepPink,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
