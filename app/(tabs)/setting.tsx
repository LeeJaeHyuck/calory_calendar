import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { default as React, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const [weight, setWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [bmr, setBmr] = useState("");
  const [intake, setIntake] = useState("");
  const [exercise, setExercise] = useState("");
  const [mealLimit, setMealLimit] = useState(""); // 한끼당 제한 칼로리
  const [startDate, setStartDate] = useState("");
  const [gender, setGender] = useState(""); // "male" or "female"
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [weeklyViewMode, setWeeklyViewMode] = useState("all"); // "all", "photos", "calories"

  // ------------------------------------------------------
  // 저장된 설정 로드
  // ------------------------------------------------------
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const saved = await AsyncStorage.getItem("user-settings");
        if (saved) {
          const data = JSON.parse(saved);
          setWeight(String(data.weight || ""));
          setTargetWeight(String(data.targetWeight || ""));
          setBmr(String(data.bmr || ""));
          setIntake(String(data.intake || ""));
          setExercise(String(data.exercise || ""));
          setMealLimit(String(data.mealLimit || ""));
          setStartDate(String(data.startDate || ""));
          setGender(String(data.gender || ""));
          setAge(String(data.age || ""));
          setHeight(String(data.height || ""));
          setWeeklyViewMode(String(data.weeklyViewMode || "all"));
        }
      })();
    }, [])
  );

  // ------------------------------------------------------
  // 목표 소모 칼로리 계산 (Setting에서 "정답" 계산)
  // ------------------------------------------------------
  const goalBurn = Math.max(
    0,
    (parseInt(bmr) || 0) +
      (parseInt(exercise) || 0) -
      (parseInt(intake) || 0)
  );

  // ------------------------------------------------------
  // 기초대사량 자동 계산
  // ------------------------------------------------------
  const calculateBMR = () => {
    const w = parseFloat(weight) || 0;
    const h = parseFloat(height) || 0;
    const a = parseInt(age) || 0;

    if (w === 0 || h === 0 || a === 0) {
      alert("체중, 키, 나이를 모두 입력해주세요!");
      return;
    }

    if (!gender) {
      alert("성별을 선택해주세요!");
      return;
    }

    let calculated = 0;
    if (gender === "male") {
      // 남성: (10 × 체중kg) + (6.25 × 키cm) - (5 × 나이) + 5
      calculated = 10 * w + 6.25 * h - 5 * a + 5;
    } else {
      // 여성: (10 × 체중kg) + (6.25 × 키cm) - (5 × 나이) - 161
      calculated = 10 * w + 6.25 * h - 5 * a - 161;
    }

    setBmr(Math.round(calculated).toString());
    alert(`기초대사량이 자동으로 계산되었습니다!\n${Math.round(calculated)} kcal`);
  };

  // ------------------------------------------------------
  // 설정 저장
  // ------------------------------------------------------
  const saveSettings = async () => {
    const data = {
      weight,
      targetWeight,
      bmr: parseInt(bmr) || 0,
      intake: parseInt(intake) || 0,
      exercise: parseInt(exercise) || 0,
      mealLimit: parseInt(mealLimit) || 0,
      startDate,
      gender,
      age: parseInt(age) || 0,
      height: parseFloat(height) || 0,
      weeklyViewMode,

      // 🎯 중요한 부분
      goalBurn: goalBurn,
    };

    await AsyncStorage.setItem("user-settings", JSON.stringify(data));
    alert("설정이 저장되었습니다! 💾");
    setIsEditing(false);
  };

  const renderField = (
    label: string,
    value: string,
    setter: (text: string) => void,
    unit: string,
    placeholder: string,
    keyboardType: "numeric" | "default" = "numeric"
  ) => {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>

        {isEditing ? (
          <TextInput
            style={styles.input}
            keyboardType={keyboardType}
            value={value || ""}
            onChangeText={(text) => setter(text || "")}
            placeholder={placeholder}
          />
        ) : (
          <Text style={styles.viewText}>{value ? `${value}` : "-"}</Text>
        )}

        {!isEditing && <Text style={styles.unit}>{unit}</Text>}
      </View>
    );
  };

  const renderGenderPicker = () => {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>성별 :</Text>
        {isEditing ? (
          <View style={styles.genderContainer}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === "male" && styles.genderButtonActive,
              ]}
              onPress={() => setGender("male")}
            >
              <Text
                style={[
                  styles.genderText,
                  gender === "male" && styles.genderTextActive,
                ]}
              >
                남성
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === "female" && styles.genderButtonActive,
              ]}
              onPress={() => setGender("female")}
            >
              <Text
                style={[
                  styles.genderText,
                  gender === "female" && styles.genderTextActive,
                ]}
              >
                여성
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.viewText}>
            {gender === "male" ? "남성" : gender === "female" ? "여성" : "-"}
          </Text>
        )}
      </View>
    );
  };

  const renderWeeklyViewModePicker = () => {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>주간 페이지 보기 :</Text>
        {isEditing ? (
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                weeklyViewMode === "all" && styles.viewModeButtonActive,
              ]}
              onPress={() => setWeeklyViewMode("all")}
            >
              <Text
                style={[
                  styles.viewModeText,
                  weeklyViewMode === "all" && styles.viewModeTextActive,
                ]}
              >
                전체
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                weeklyViewMode === "photos" && styles.viewModeButtonActive,
              ]}
              onPress={() => setWeeklyViewMode("photos")}
            >
              <Text
                style={[
                  styles.viewModeText,
                  weeklyViewMode === "photos" && styles.viewModeTextActive,
                ]}
              >
                사진
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                weeklyViewMode === "calories" && styles.viewModeButtonActive,
              ]}
              onPress={() => setWeeklyViewMode("calories")}
            >
              <Text
                style={[
                  styles.viewModeText,
                  weeklyViewMode === "calories" && styles.viewModeTextActive,
                ]}
              >
                칼로리
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.viewText}>
            {weeklyViewMode === "all"
              ? "전체 정보"
              : weeklyViewMode === "photos"
              ? "사진만"
              : "칼로리+몸무게"}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* HEADER */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.profileCircle}>
                <Image
                  source={require("../../assets/images/profile-placeholder.png")}
                  style={styles.profileImage}
                  onError={() => console.log("이미지 로드 실패")}
                />
              </TouchableOpacity>
              <Text style={styles.title}>My Page</Text>
            </View>

            {/* 기본 정보 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>기본 정보</Text>
              {renderField(
                "다이어트 시작일 :",
                startDate,
                setStartDate,
                "",
                "예: 2024-01-01",
                "default"
              )}
              {renderGenderPicker()}
              {renderField("나이 :", age, setAge, " 세", "예: 25")}
              {renderField("키 :", height, setHeight, " cm", "예: 170")}
              {renderField("현재 몸무게 :", weight, setWeight, " kg", "예: 60")}
              {renderField(
                "목표 몸무게 :",
                targetWeight,
                setTargetWeight,
                " kg",
                "예: 55"
              )}

              {/* 기초대사량 필드 */}
              <View style={styles.row}>
                <Text style={styles.label}>기초대사량 :</Text>
                {isEditing ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      keyboardType="numeric"
                      value={bmr || ""}
                      onChangeText={(text) => setBmr(text || "")}
                      placeholder="예: 1500"
                    />
                    <TouchableOpacity
                      style={styles.calcButton}
                      onPress={calculateBMR}
                    >
                      <Text style={styles.calcButtonText}>자동계산</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.viewText}>{bmr ? `${bmr}` : "-"}</Text>
                    <Text style={styles.unit}> kcal</Text>
                  </>
                )}
              </View>
            </View>

            {/* 화면 설정 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>화면 설정</Text>
              {renderWeeklyViewModePicker()}
            </View>

            {/* 목표 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>목표</Text>
              {renderField(
                "섭취 칼로리 :",
                intake,
                setIntake,
                " kcal",
                "예: 1800"
              )}
              {renderField(
                "운동 칼로리 :",
                exercise,
                setExercise,
                " kcal",
                "예: 300"
              )}
              {renderField(
                "한끼당 제한 :",
                mealLimit,
                setMealLimit,
                " kcal",
                "예: 600"
              )}

              {/* 보기 모드에서만 표시 */}
              {!isEditing && (
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={[styles.label, { color: "#333" }]}>
                    소모 칼로리 :
                  </Text>
                  <Text style={styles.totalValue}>{goalBurn} kcal</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Save / Edit 버튼 */}
      <TouchableOpacity
        onPress={() => {
          if (isEditing) saveSettings();
          else setIsEditing(true);
        }}
        style={styles.saveButton}
      >
        <Text style={styles.saveText}>
          {isEditing ? "💾 저장하기" : "✏️ 수정하기"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8" },
  scrollContent: { padding: 20 },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 25 },

  profileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: pink,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: "cover",
  },

  title: { fontSize: 26, fontWeight: "700", color: "#FF80A0" },

  box: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF7FA0",
    marginBottom: 10,
  },

  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  label: { flex: 1.2, fontSize: 16, color: "#444", fontWeight: "500" },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: pink,
    borderRadius: 8,
    height: 35,
    paddingHorizontal: 8,
    textAlign: "right",
    backgroundColor: "#FFF",
  },
  unit: { width: 40, textAlign: "left", fontSize: 15, color: "#888" },

  viewText: {
    flex: 1,
    textAlign: "right",
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },

  saveButton: {
    backgroundColor: deepPink,
    shadowColor: "#000",
    borderRadius: 30,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 30,
  },
  saveText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  totalRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#FFD6E0",
    paddingTop: 10,
  },
  totalValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 17,
    fontWeight: "700",
    color: "#FF7FA0",
  },

  genderContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: pink,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  genderButtonActive: {
    backgroundColor: deepPink,
    borderColor: deepPink,
  },
  genderText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  genderTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },

  calcButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  calcButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  viewModeContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: pink,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  viewModeButtonActive: {
    backgroundColor: deepPink,
    borderColor: deepPink,
  },
  viewModeText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  viewModeTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },
});
