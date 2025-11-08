import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { default as React, useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  // ⚙️ MyPage 연동
  const [bmf, setBmf] = useState(1100); // 기초대사량
  const [goalFoodKcal, setGoalFoodKcal] = useState(800); // 목표 섭취량
  const [goalExKcal, setGoalExKcal] = useState(0); // 추가 운동 목표
  // 목표 소모량
  const goalSubKcal = React.useMemo(
    () => bmf - goalFoodKcal + goalExKcal,
    [bmf, goalFoodKcal, goalExKcal]
  );

  // useEffect(() => {
  //   (async () => {
  //     const userSettings = await AsyncStorage.getItem("user-settings");
  //     if (userSettings) {
  //       const parsed = JSON.parse(userSettings);
  //       setBmf(parsed.bmr || 1100);
  //       setGoalFoodKcal(parsed.intake || 800);
  //       setGoalExKcal(parsed.exercise || 0);
  //     }
  //   })();
  // }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setBmf(parsed.bmr || 1100);
          setGoalFoodKcal(parsed.intake || 800);
          setGoalExKcal(parsed.exercise || 0);
        }
      })();
    }, [])
  );

  const params = useLocalSearchParams();
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [meals, setMeals] = useState<Meals>({
    Breakfast: [{ name: "", kcal: 0 }],
    Lunch: [{ name: "", kcal: 0 }],
    Dinner: [{ name: "", kcal: 0 }],
  });
  const [isSaved, setIsSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (params?.date) setDate(String(params.date));
    }, [params?.date])
  );

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(`meals-${date}`);
      if (saved) setMeals(JSON.parse(saved));
      else
        setMeals({
          Breakfast: [{ name: "", kcal: 0 }],
          Lunch: [{ name: "", kcal: 0 }],
          Dinner: [{ name: "", kcal: 0 }],
        });
      setIsSaved(false);
    })();
  }, [date]);


    useEffect(() => {
      const reloadOnFocus = async () => {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setBmf(parsed.bmr || 1100);
          setGoalFoodKcal(parsed.intake || 800);
          setGoalExKcal(parsed.exercise || 0);
        }
      };
  
      // 앱이 포그라운드로 돌아오거나 탭 포커스될 때 다시 로드
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") reloadOnFocus();
      });
  
      return () => sub.remove();
    }, []);

  const updateMeal = (
    type: keyof Meals,
    index: number,
    key: keyof Meal,
    value: string
  ) => {
    const updated = { ...meals };
    updated[type][index][key] =
      key === "kcal" ? parseInt(value) || 0 : (value as any);
    setMeals(updated);
    setIsSaved(false);
  };

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

  const total = Object.values(meals)
    .flat()
    .reduce((s, m) => s + (m.kcal || 0), 0);
  const subKcal = bmf - total; // 실제 소모량

  const saveMeals = async () => {
    await AsyncStorage.setItem(`meals-${date}`, JSON.stringify(meals));
    setIsSaved(true);

    // ✅ 목표 달성 여부 계산
    if (goalFoodKcal >= total && goalSubKcal <= subKcal) {
      Alert.alert("참 잘했어요! 🎉", "오늘 목표를 달성했습니다!");
    } else {
      const diff = goalSubKcal - subKcal;
      if (diff > 0) {
        Alert.alert(
          "운동 추천",
          `${diff} kcal 소모할 운동을 추천할까요?`,
          [
            { text: "취소", style: "cancel" },
            {
              text: "추천받기",
              onPress: () => {
                // ✅ 칼로리 범위별 운동 추천
                if (diff <= 100)
                  Alert.alert("운동 추천 🏋️‍♂️", "플랭크 50초 × 3세트");
                else if (diff <= 300)
                  Alert.alert("운동 추천 🏃‍♀️", "러닝 10분");
                else if (diff <= 500)
                  Alert.alert("운동 추천 🧘‍♀️", "스쿼트 30회 × 3세트");
                else
                  Alert.alert("운동 추천 💪", "런지 20회 × 4세트 + 스트레칭");
              },
            },
          ]
        );
      } else {
        Alert.alert("좋아요 👍", "소모량이 목표를 초과했어요!");
      }
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
          <Text style={styles.title}>🍓 {date}</Text>
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

        <Text
          style={[
            styles.total,
            total > goalFoodKcal && { color: "#FF6B6B" },
          ]}
        >
          총 섭취 칼로리: {total} kcal
        </Text>
        <Text
          style={[
            styles.total,
            subKcal < goalSubKcal && { color: "#FF6B6B" },
          ]}
        >
          총 소모 칼로리: {subKcal} kcal
        </Text>

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
  total: {
    bottom: -20,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 0,
    color: "#77a4f8ff",
  },
  saveButton: {
    position: "absolute",
    bottom: -25,
    alignSelf: "flex-start",
    backgroundColor: deepPink,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
