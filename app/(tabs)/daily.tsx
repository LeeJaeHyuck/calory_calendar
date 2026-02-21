import exercisesData from "@/assets/datas/exercises.json";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { checkAndAwardBadges, countBadges } from "../../utils/badgeUtils";
import { scheduleMealNotifications } from "../../utils/notificationUtils";

interface Meal {
  name: string;
  kcal: number;
}
interface Meals {
  Breakfast: Meal[];
  Lunch: Meal[];
  Dinner: Meal[];
}
interface Weight {
  weight: number;
}
interface Photo {
  uri: string;
  timestamp: string;
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
  const [goalIntake, setGoalIntake] = useState(0); // 🔥 목표 섭취 칼로리
  const [goalBurn, setGoalBurn] = useState(0); // 🔥 목표 소모 칼로리
  const [exercise, setExercise] = useState(0);
  const [mealLimit, setMealLimit] = useState(0); // 한끼당 제한 칼로리
  const [startDate, setStartDate] = useState("");

  // 누적 칼로리
  const [totalIntakeFromStart, setTotalIntakeFromStart] = useState(0);
  const [totalBurnFromStart, setTotalBurnFromStart] = useState(0);

  // 모든 날짜의 식단 기록을 불러와서 고유한 음식 목록 생성 (캐싱 최적화)
  const loadFoodHistory = useCallback(async () => {
    try {
      // 캐시된 히스토리 먼저 확인
      const cached = await AsyncStorage.getItem("food-history-cache");
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          setFoodHistory(parsedCache);
        } catch (e) {
          console.error("Failed to parse food history cache:", e);
        }
      }

      // 백그라운드에서 업데이트
      const allKeys = await AsyncStorage.getAllKeys();
      const mealKeys = allKeys.filter(key => key.startsWith("meals-"));

      const allMealsData = await AsyncStorage.multiGet(mealKeys);
      const foodMap = new Map<string, Meal>();

      allMealsData.forEach(([key, value]) => {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            Object.values(parsed).flat().forEach((meal: any) => {
              if (meal.name && meal.kcal) {
                // 같은 이름의 음식이 있으면 가장 최근 칼로리로 업데이트
                foodMap.set(meal.name, { name: meal.name, kcal: meal.kcal });
              }
            });
          } catch (e) {
            // 파싱 에러 무시
          }
        }
      });

      const history = Array.from(foodMap.values());
      setFoodHistory(history);

      // 캐시 저장
      await AsyncStorage.setItem("food-history-cache", JSON.stringify(history));
    } catch (error) {
      console.error("Failed to load food history:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem("user-settings");
          if (saved) {
            const parsed = JSON.parse(saved);
            setBmr(parsed.bmr || 1100);
            setGoalBurn(parsed.goalBurn || 0);
            setGoalIntake(parsed.intake || 0);
            setMealLimit(parsed.mealLimit || 0);
            setStartDate(parsed.startDate || "");
          }
        } catch (e) {
          console.error("Failed to load user settings:", e);
        }

        // 모든 식단 기록 불러오기
        await loadFoodHistory();
      })();
    }, [loadFoodHistory])
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
  const [weight, setWeight] = useState<number>(0);
  const [weightStr, setWeightStr] = useState<string>('');
  const [dailyExercise, setDailyExercise] = useState<number>(0);
  const [dailyExerciseNm, setDailyExerciseNm] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [showTooltip, setShowTooltip] = useState<null | "intake" | "burn">(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [foodHistory, setFoodHistory] = useState<Meal[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState<{ type: keyof Meals; index: number } | null>(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Meal[]>([]);
  const [showExerciseRecommendation, setShowExerciseRecommendation] = useState(false);
  const [diary, setDiary] = useState<string>("");

  // setTimeout cleanup을 위한 ref
  // const autocompleteTimeoutRef = useRef<NodeJS.Timeout>();
  const autocompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // cleanup 함수
  useEffect(() => {
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (weightStr !== undefined && weightStr.length > 0) {
      setWeight(parseFloat(weightStr))
    }
  }, [weightStr]);

  // 날짜 이동 시 데이터 불러오기
  useFocusEffect(
    useCallback(() => {
      if (params?.date) setDate(String(params.date));
    }, [params?.date])
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(`meals-${date}`);
        if (saved) {
          try {
            setMeals(JSON.parse(saved));
          } catch (e) {
            console.error("Failed to parse meals:", e);
            setMeals({
              Breakfast: [{ name: "", kcal: 0 }],
              Lunch: [{ name: "", kcal: 0 }],
              Dinner: [{ name: "", kcal: 0 }],
            });
          }
        } else {
          setMeals({
            Breakfast: [{ name: "", kcal: 0 }],
            Lunch: [{ name: "", kcal: 0 }],
            Dinner: [{ name: "", kcal: 0 }],
          });
        }

        const savedWeight = await AsyncStorage.getItem(`weight-${date}`);
        if (savedWeight) {
          try {
            setWeight(JSON.parse(savedWeight));
            setWeightStr(JSON.parse(savedWeight));
          } catch (e) {
            console.error("Failed to parse weight:", e);
            setWeight(0);
            setWeightStr('');
          }
        } else {
          setWeight(0);
          setWeightStr('');
        }

        const savedExercise = await AsyncStorage.getItem(`exercise-${date}`);
        if (savedExercise) {
          try {
            setDailyExercise(JSON.parse(savedExercise));
          } catch (e) {
            console.error("Failed to parse exercise:", e);
            setDailyExercise(0);
          }
        } else {
          setDailyExercise(0);
        }

        const savedPhotos = await AsyncStorage.getItem(`photos-${date}`);
        if (savedPhotos) {
          try {
            setPhotos(JSON.parse(savedPhotos));
          } catch (e) {
            console.error("Failed to parse photos:", e);
            setPhotos([]);
          }
        } else {
          setPhotos([]);
        }

        const savedDiary = await AsyncStorage.getItem(`diary-${date}`);
        if (savedDiary) {
          try {
            setDiary(JSON.parse(savedDiary));
          } catch (e) {
            console.error("Failed to parse diary:", e);
            setDiary("");
          }
        } else {
          setDiary("");
        }

        setIsSaved(false);
      } catch (error) {
        console.error("Failed to load daily data:", error);
      }
    })();
  }, [date]);

  // 앱 재진입 시 최신 goalBurn/bmr 로드
  useEffect(() => {
    const reloadOnFocus = async () => {
      try {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          setBmr(parsed.bmr || 0);
          setGoalBurn(parsed.goalBurn || 0);
          setGoalIntake(parsed.intake || 0);
          setExercise(parsed.exercise || 0);
          setMealLimit(parsed.mealLimit || 0);
          setStartDate(parsed.startDate || "");
        }
      } catch (e) {
        console.error("Failed to reload settings:", e);
      }
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reloadOnFocus();
    });
    return () => sub.remove();
  }, []);

  // 다이어트 시작일부터 누적 칼로리 계산
  useEffect(() => {
    const calculateTotalFromStart = async () => {
      if (!startDate) {
        setTotalIntakeFromStart(0);
        setTotalBurnFromStart(0);
        return;
      }

      let settingBmr = 0;
      let settingExercise = 0;
      try {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const parsed = JSON.parse(saved);
          settingBmr = parsed.bmr || 0;
          settingExercise = parsed.exercise || 0;
        }
      } catch (e) {
        console.error("Failed to parse user settings:", e);
      }

      const start = new Date(startDate);
      const today = new Date(date);

      let totalIntake = 0;
      let totalBurn = 0;

      // 시작일부터 현재 날짜까지 반복
      for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);

        try {
          const mealsRaw = await AsyncStorage.getItem(`meals-${dateStr}`);
          const exerciseRaw = await AsyncStorage.getItem(`exercise-${dateStr}`);

          let dailyIntake = 0;
          if (mealsRaw) {
            const parsed = JSON.parse(mealsRaw);
            dailyIntake = Object.values(parsed)
              .flat()
              .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
          }

          let dailyExercise = 0;
          if (exerciseRaw) {
            dailyExercise = JSON.parse(exerciseRaw);
          }

          totalIntake += dailyIntake;
          // 하루 소모량 = BMR + 설정운동 + 당일운동 - 섭취량
          const dailyBurn = settingBmr + dailyExercise - dailyIntake;
          totalBurn += dailyBurn;
        } catch (e) {
          // 에러 무시하고 계속
        }
      }

      setTotalIntakeFromStart(totalIntake);
      setTotalBurnFromStart(totalBurn);
    };

    calculateTotalFromStart();
  }, [date, startDate, meals, dailyExercise]);

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

    if (key === "kcal") {
      updated[type][index][key] = parseInt(value) || 0;
    } else {
      updated[type][index][key] = value;

      // 음식 이름 입력 시 자동완성 필터링
      if (key === "name" && value) {
        const filtered = foodHistory.filter(food =>
          food.name.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredSuggestions(filtered);
        setActiveSuggestion({ type, index });
      } else {
        setFilteredSuggestions([]);
        setActiveSuggestion(null);
      }
    }

    setMeals(updated);
    setIsSaved(false);
  };

  // 자동완성에서 음식 선택
  const selectSuggestion = (type: keyof Meals, index: number, food: Meal) => {
    const updated = { ...meals };
    updated[type] = [...updated[type]];
    updated[type][index] = { name: food.name, kcal: food.kcal };
    setMeals(updated);
    setFilteredSuggestions([]);
    setActiveSuggestion(null);
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

  // 실제 소모량 = BMR + 설정 운동칼로리 + 당일 운동칼로리 - 섭취량
  const subKcal = bmr + dailyExercise - total;

  // 목표 달성을 위해 더 소모해야 하는 칼로리
  const diff = goalBurn - subKcal;

  // diff 값에 기반한 운동 추천
  const getRecommendedExercises = () => {
    if (diff <= 0) {
      return [];
    }

    // diff 값과 가까운 운동들을 찾기 (±100 kcal 범위)
    const tolerance = 100;
    const recommended = exercisesData.exercises
      .filter(exercise =>
        Math.abs(exercise.calories - diff) <= tolerance
      )
      .sort((a, b) =>
        Math.abs(a.calories - diff) - Math.abs(b.calories - diff)
      )
      .slice(0, 5); // 상위 5개만 표시

    // 가까운 운동이 없으면 전체 목록에서 선택
    if (recommended.length === 0) {
      return exercisesData.exercises
        .sort((a, b) =>
          Math.abs(a.calories - diff) - Math.abs(b.calories - diff)
        )
        .slice(0, 5);
    }

    return recommended;
  };

  // 사진 선택 (여러 장)
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("권한 필요", "사진을 선택하려면 갤러리 접근 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const newPhotos = result.assets.map(asset => ({
        uri: asset.uri,
        timestamp: timestamp,
      }));

      const updatedPhotos = [...photos, ...newPhotos];
      setPhotos(updatedPhotos);
      await AsyncStorage.setItem(`photos-${date}`, JSON.stringify(updatedPhotos));
      setIsSaved(false);
    }
  };

  // 사진 삭제
  const deletePhoto = async (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    await AsyncStorage.setItem(`photos-${date}`, JSON.stringify(newPhotos));
    setIsSaved(false);
  };

  // 저장
  const saveMeals = async () => {
    await AsyncStorage.setItem(`meals-${date}`, JSON.stringify(meals));
    await AsyncStorage.setItem(`weight-${date}`, JSON.stringify(weight));
    await AsyncStorage.setItem(`exercise-${date}`, JSON.stringify(dailyExercise));
    await AsyncStorage.setItem(`photos-${date}`, JSON.stringify(photos));
    await AsyncStorage.setItem(`diary-${date}`, JSON.stringify(diary));

    // 식단 기록 업데이트
    await loadFoodHistory();

    // 뱃지 체크 및 수여/회수
    await checkAndAwardBadges();

    // 식단 알림 스케줄링 (오늘 날짜인 경우만)
    await scheduleMealNotifications(date, meals.Breakfast, meals.Lunch, meals.Dinner);

    setIsSaved(true);
    // 뱃지 개수 업데이트 (체크는 하지 않음)
    const count = await countBadges();

    // 한끼당 제한 칼로리 체크
    if (mealLimit > 0) {
      const breakfastTotal = meals.Breakfast.reduce((s, m) => s + (m.kcal || 0), 0);
      const lunchTotal = meals.Lunch.reduce((s, m) => s + (m.kcal || 0), 0);
      const dinnerTotal = meals.Dinner.reduce((s, m) => s + (m.kcal || 0), 0);

      const overMeals = [];
      if (breakfastTotal > mealLimit) overMeals.push(`아침(${breakfastTotal} kcal)`);
      if (lunchTotal > mealLimit) overMeals.push(`점심(${lunchTotal} kcal)`);
      if (dinnerTotal > mealLimit) overMeals.push(`저녁(${dinnerTotal} kcal)`);

      if (overMeals.length > 0) {
        Alert.alert(
          "⚠️ 한끼 칼로리 초과",
          `${overMeals.join(", ")}이(가) 한끼 제한(${mealLimit} kcal)을 초과했습니다.`
        );
        return;
      }
    }

    // 목표 달성 여부 계산
    if (subKcal >= goalBurn) {
      Alert.alert("목표를 달성하여 뱃지를 받았어요 🎉", `지금까지 ${count} 개의 뱃지를 모았어요!`);
    } else {
      const diff = goalBurn - subKcal;
      Alert.alert("조금만 더 힘내세요! 💪", `자정 전까지 ${diff} kcal를 소모하면 뱃지를 얻을 수 있어요!`);
    }
  };

  const changeDay = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(formatDate(d));
  };

  const goToday = () => setDate(formatDate(new Date()));

  // 식단 추천 기능
  const recommendMeals = () => {
    if (foodHistory.length === 0) {
      Alert.alert("식단 기록 없음", "추천할 식단 기록이 없습니다. 먼저 식단을 기록해주세요!");
      return;
    }

    Alert.alert(
      "오늘의 식단 추천",
      "기록된 음식 기반으로 목표 칼로리에 맞게 식단이 생성됩니다. 계속하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          onPress: () => generateRecommendedMeals(),
        },
      ]
    );
  };

  const generateRecommendedMeals = async () => {
    // 목표 칼로리 = BMR (기초대사량을 기준으로)
    const targetCalories = goalIntake;

    // 각 끼니별 목표 칼로리 (아침 30%, 점심 40%, 저녁 30%)
    const breakfastTarget = Math.floor(targetCalories * 0.3);
    const lunchTarget = Math.floor(targetCalories * 0.4);
    const dinnerTarget = Math.floor(targetCalories * 0.3);

    // 최근 7일간 먹은 음식 가져오기 (선호도 가중치 부여)
    const recentMeals = await getRecentMeals(7);

    const recommendedMeals: Meals = {
      Breakfast: selectMealsForTarget(breakfastTarget, 1, 3, recentMeals),
      Lunch: selectMealsForTarget(lunchTarget, 1, 3, recentMeals),
      Dinner: selectMealsForTarget(dinnerTarget, 1, 3, recentMeals),
    };

    setMeals(recommendedMeals);
    setIsSaved(false);

    const totalRecommended = Object.values(recommendedMeals)
      .flat()
      .reduce((sum, m) => sum + m.kcal, 0);

    Alert.alert(
      "식단 추천 완료! 🍽️",
      `총 ${totalRecommended} kcal의 식단을 추천했습니다.\n목표: ${targetCalories} kcal`
    );
  };

  // 최근 N일간 먹은 음식 목록 가져오기
  const getRecentMeals = async (days: number): Promise<string[]> => {
    const recentFoods: string[] = [];
    const today = new Date(date);

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);

      try {
        const mealsRaw = await AsyncStorage.getItem(`meals-${dateStr}`);
        if (mealsRaw) {
          const parsed = JSON.parse(mealsRaw);
          Object.values(parsed).flat().forEach((meal: any) => {
            if (meal.name) {
              recentFoods.push(meal.name);
            }
          });
        }
      } catch (e) {
        // 에러 무시
      }
    }

    return recentFoods;
  };

  const renderWeightSection = () => (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>몸무게</Text>
        {/* <Text style={styles.mealTotal}>
          {weight ? `${weight} kg` : ""}
        </Text> */}
      </View>

      <View style={styles.foodRow}>
        <View style={{ flex: 2, marginRight: 6 }}>
          <TextInput
            style={[styles.foodInput, { flex: 1 }]}
            // placeholder="몸무게 (kg)"
            keyboardType="numeric"  //"decimal-pad"
            // returnKeyType="done"
            // onSubmitEditing={() => Keyboard.dismiss()}
            value={weightStr ? String(weightStr) : ""}
            onChangeText={(v) => {
              const filtered = v.replace(/[^0-9.]/g, "");
              const parts = filtered.split(".");
              if (parts.length > 3) return; // 소수점 2개 이상 방지
              setWeightStr(filtered);
              setIsSaved(false);
            }}
          />
        </View>
         <Text style={styles.mealTotal}>
          kg
        </Text>
        {/* <TextInput
          style={styles.kcalInput}
          value={"kg"}
          editable={false}
          selectTextOnFocus={false}
        /> */}
      </View>
    </View>
  );

  const renderExerciseSection = () => (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>운동 칼로리</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setShowExerciseRecommendation(true)}
            style={styles.exerciseRecommendButton}
          >
            <Text style={styles.exerciseRecommendText}>🏃 운동 추천</Text>
          </TouchableOpacity>
          <Text style={styles.mealTotal}>
            {dailyExercise ? `${dailyExercise} kcal` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.foodRow}>
        <View style={{ flex: 2, marginRight: 6 }}>
          <TextInput
            style={[styles.foodInput, { flex: 1 }]}
            placeholder="운동 이름"
            // onSubmitEditing={() => Keyboard.dismiss()}
            value={dailyExerciseNm ? String(dailyExerciseNm) : ""}
            onChangeText={(v) => {
              setDailyExerciseNm(v);
            }}
          />
        </View>
        <TextInput
          style={styles.kcalInput}
          placeholder="kcal"
          keyboardType="numeric"
          value={dailyExercise ? String(dailyExercise) : ""}
          onChangeText={(v) => {
            setDailyExercise(parseInt(v) || 0);
            setIsSaved(false);
          }}
        />
      </View>
    </View>
  );

  const renderPhotoSection = () => (
  <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>사진</Text>
        <TouchableOpacity onPress={pickImage} style={styles.photoAddButton}>
          <Text style={styles.addText}>📷 추가</Text>
        </TouchableOpacity>
      </View>
      {photos.length > 0 ? (
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <View style={styles.photoTimeLabel}>
                <Text style={styles.photoTimeText}>{photo.timestamp}</Text>
              </View>
              <TouchableOpacity
                onPress={() => deletePhoto(index)}
                style={styles.photoDeleteButton}
              >
                <Text style={styles.photoDeleteText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noPhotoText}>등록된 사진이 없습니다</Text>
      )}
    </View>
  );

  const renderDiarySection = () => (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Text style={styles.mealTitle}>일기</Text>
        <Text style={styles.noPhotoText}>계획한 식단을 잘 지켰는지, 목표만큼 소모했는지 기록해 주세요.</Text>
      </View>
      <TextInput
        style={styles.diaryInput}
        // placeholder="계획한 식단을 잘 지켰는지, 목표만큼 소모했는지 기록해 주세요."
        // placeholderTextColor="#999"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        value={diary}
        onChangeText={(text) => {
          setDiary(text);
          setIsSaved(false);
        }}
      />
    </View>
  );


  // 목표 칼로리에 맞는 식단 선택 (선호도 가중치 적용)
  const selectMealsForTarget = (
    targetCalories: number,
    minItems: number,
    maxItems: number,
    recentMeals: string[]
  ): Meal[] => {
    if (foodHistory.length === 0) return [{ name: "", kcal: 0 }];

    const numItems = Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;
    const selected: Meal[] = [];
    let currentTotal = 0;

    // 최근에 먹은 음식에 가중치 부여
    const weighted = foodHistory.map(food => ({
      ...food,
      weight: recentMeals.includes(food.name) ? 2 : 1,
    }));

    // 가중치를 고려한 랜덤 셔플
    const shuffled = [...weighted].sort((a, b) => {
      const randA = Math.random() * a.weight;
      const randB = Math.random() * b.weight;
      return randB - randA;
    });

    for (let i = 0; i < numItems && shuffled.length > 0; i++) {
      const remaining = targetCalories - currentTotal;

      // 남은 칼로리에 가까운 음식 찾기
      const candidate = shuffled.find(
        (food) => food.kcal <= remaining + 100 && food.kcal >= remaining - 200
      ) || shuffled[0];

      selected.push({ name: candidate.name, kcal: candidate.kcal });
      currentTotal += candidate.kcal;

      // 선택한 음식은 제거 (중복 방지)
      const idx = shuffled.indexOf(candidate);
      shuffled.splice(idx, 1);

      // 목표 칼로리에 근접하면 종료
      if (currentTotal >= targetCalories * 0.8 || shuffled.length === 0) break;
    }

    return selected.length > 0 ? selected : [{ name: "", kcal: 0 }];
  };

  const renderMeal = (type: keyof Meals) => {
    const mealFoods = meals[type];
    const mealTotal = mealFoods.reduce((sum, f) => sum + (f.kcal || 0), 0);
    const isOverLimit = mealLimit > 0 && mealTotal > mealLimit;

    return (
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <Text style={styles.mealTitle}>{type}</Text>
          <Text style={[styles.mealTotal, isOverLimit && { color: "#FF0000" }]}>
            {mealTotal} kcal
            {isOverLimit && " ⚠️"}
          </Text>
        </View>

        {mealFoods.map((m, i) => (
          <View key={i}>
            <View style={styles.foodRow}>
              <View style={{ flex: 2, marginRight: 6 }}>
                <TextInput
                  style={styles.foodInput}
                  placeholder="음식 이름"
                  value={m.name}
                  onChangeText={(v) => updateMeal(type, i, "name", v)}
                  onBlur={() => {
                    // 이전 timeout 취소
                    if (autocompleteTimeoutRef.current) {
                      clearTimeout(autocompleteTimeoutRef.current);
                    }
                    // 새로운 timeout 설정 (더 길게 변경하여 클릭할 시간 확보)
                    autocompleteTimeoutRef.current = setTimeout(() => {
                      setFilteredSuggestions([]);
                      setActiveSuggestion(null);
                    }, 300);
                  }}
                />
                {activeSuggestion?.type === type &&
                  activeSuggestion?.index === i &&
                  filteredSuggestions.length > 0 && (
                    <View style={styles.autocompleteContainer}>
                      {filteredSuggestions.slice(0, 5).map((food, idx) => (
                        <Pressable
                          key={idx}
                          style={styles.autocompleteItem}
                          onPress={() => {
                            // timeout 취소하여 자동완성이 사라지지 않도록
                            if (autocompleteTimeoutRef.current) {
                              clearTimeout(autocompleteTimeoutRef.current);
                            }
                            selectSuggestion(type, i, food);
                          }}
                        >
                          <Text style={styles.autocompleteName}>{food.name}</Text>
                          <Text style={styles.autocompleteKcal}>{food.kcal} kcal</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
              </View>
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
          <Text style={[
            styles.title,
            new Date(date) < new Date(formatDate(new Date())) && { color: "#C0C0C0" }
          ]}>
            🍓 {formatKoreanDate(new Date(date))}
          </Text>

          <TouchableOpacity onPress={() => changeDay(1)}>
            <Text style={styles.navBtn}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={goToday} style={styles.todayButton}>
            <Text style={styles.todayText}>오늘로 이동</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={recommendMeals} style={styles.recommendButton}>
            <Text style={styles.recommendText}>🍽️ 오늘의 식단추천</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={Object.keys(meals) as (keyof Meals)[]}
          renderItem={({ item }) => renderMeal(item)}
          keyExtractor={(item) => item}
           ListFooterComponent={
            <>
              {/* 몸무게 섹션 */}
              {renderWeightSection()}

              {/* 운동칼로리 */}
              {renderExerciseSection()}

              {/* 사진 */}
              {renderPhotoSection()}

              {/* 일기 */}
              {renderDiarySection()}
            </>
          }
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
                오늘 섭취: {total} kcal
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
                오늘 소모: {subKcal} kcal
              </Text>
              <Pressable onPress={() => setShowTooltip("burn")}>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </Pressable>
            </View>

            {startDate && new Date(date) <= new Date() && (
              <>
                {/* <View style={styles.infoRow}>
                  <Text style={[styles.total, { color: "#9C27B0" }]}>
                    누적 섭취: {totalIntakeFromStart} kcal
                  </Text>
                </View> */}
                <View style={styles.infoRow}>
                  <Text style={[styles.total, { color: "#9C27B0" }]}>
                    누적 소모: {totalBurnFromStart} kcal
                  </Text>
                  <Pressable onPress={() => setShowTooltip("burn")}>
                    <Text style={styles.infoIcon}>ⓘ</Text>
                  </Pressable>
                </View>
              </>
            )}
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

        {/* 운동 추천 모달 */}
        <Modal
          transparent
          visible={showExerciseRecommendation}
          animationType="slide"
          onRequestClose={() => setShowExerciseRecommendation(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.exerciseModalBox}>
              <View style={styles.exerciseModalHeader}>
                <Text style={styles.exerciseModalTitle}>🏃 오늘의 운동 추천</Text>
                <TouchableOpacity onPress={() => setShowExerciseRecommendation(false)}>
                  <Text style={styles.exerciseModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {diff > 0 ? (
                <>
                  <Text style={styles.exerciseModalSubtitle}>
                    목표 달성까지 {diff} kcal 더 소모하세요!
                  </Text>

                  <ScrollView style={styles.exerciseList}>
                    {getRecommendedExercises().map((exercise, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.exerciseItem}
                        onPress={() => {
                          setDailyExerciseNm(exercise.name);
                          setDailyExercise(exercise.calories);
                          setShowExerciseRecommendation(false);
                          setIsSaved(false);
                        }}
                      >
                        <View style={styles.exerciseItemHeader}>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                          <Text style={styles.exerciseCalories}>{exercise.calories} kcal</Text>
                        </View>
                        <Text style={styles.exerciseDuration}>⏱️ {exercise.duration}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <View style={styles.exerciseSuccessBox}>
                  <Text style={styles.exerciseSuccessText}>🎉</Text>
                  <Text style={styles.exerciseSuccessMessage}>
                    이미 목표를 달성했습니다!
                  </Text>
                </View>
              )}
            </View>
          </View>
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
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  todayButton: {
    backgroundColor: deepPink,
    paddingVertical: 6,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  todayText: { color: "#fff", fontWeight: "600" },
  recommendButton: {
    backgroundColor: "#FF9AB5",
    paddingVertical: 6,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  recommendText: { color: "#fff", fontWeight: "600" },
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
    borderWidth: 1,
    borderColor: "#FFD6E0",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
  },
  autocompleteContainer: {
    position: "absolute",
    top: 38,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FFD6E0",
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  autocompleteItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE8EE",
  },
  autocompleteName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  autocompleteKcal: {
    fontSize: 13,
    color: "#FF7FA0",
    fontWeight: "600",
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
  photoAddButton: {
    backgroundColor: pink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoWrapper: {
    position: "relative",
    width: 100,
    height: 120,
    marginBottom: 10,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  photoTimeLabel: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  photoTimeText: {
    color: "#fff",
    fontSize: 10,
    textAlign: "center",
  },
  photoDeleteButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF6B6B",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  photoDeleteText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  noPhotoText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 10,
  },
  exerciseRecommendButton: {
    backgroundColor: pink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exerciseRecommendText: {
    color: "#FF6295",
    fontWeight: "600",
    fontSize: 12,
  },
  exerciseModalBox: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  exerciseModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  exerciseModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FF7FA0",
  },
  exerciseModalClose: {
    fontSize: 28,
    color: "#999",
    fontWeight: "300",
  },
  exerciseModalSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  exerciseList: {
    maxHeight: 400,
  },
  exerciseItem: {
    backgroundColor: "#FFF5F8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFD6E0",
  },
  exerciseItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF7FA0",
  },
  exerciseCalories: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF4F84",
  },
  exerciseDuration: {
    fontSize: 14,
    color: "#999",
  },
  exerciseSuccessBox: {
    alignItems: "center",
    paddingVertical: 40,
  },
  exerciseSuccessText: {
    fontSize: 64,
    marginBottom: 16,
  },
  exerciseSuccessMessage: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4CAF50",
  },
  diaryInput: {
    borderWidth: 1,
    borderColor: "#FFD6E0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#FFF",
  },
});
