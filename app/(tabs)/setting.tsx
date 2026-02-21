import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { default as React, useState } from "react";
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import { countBadges } from "../../utils/badgeUtils";
import {
  cancelAllNotifications,
  cancelMealNotifications,
  scheduleDailyNotification
} from "../../utils/notificationUtils";

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
  const [badgeCount, setBadgeCount] = useState(0);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationHour, setNotificationHour] = useState("21");
  const [notificationMinute, setNotificationMinute] = useState("00");
  const [mealNotificationEnabled, setMealNotificationEnabled] = useState(false);

  // ------------------------------------------------------
  // 저장된 설정 로드 및 뱃지 개수 업데이트
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
          setNotificationEnabled(data.notificationEnabled || false);
          setNotificationHour(String(data.notificationHour || "21"));
          setNotificationMinute(String(data.notificationMinute || "00"));
          setMealNotificationEnabled(data.mealNotificationEnabled || false);
        }

        // 뱃지 개수 업데이트 (체크는 하지 않음)
        const count = await countBadges();
        setBadgeCount(count);
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
  // 목표 체중까지 필요한 뱃지 개수 계산
  // ------------------------------------------------------
  const kcalPerKg = 7700;
  const startWeight = parseFloat(weight) || 0;
  const goalWeight = parseFloat(targetWeight) || 0;
  const weightDiff = startWeight - goalWeight;
  const remainGoalDays = goalBurn > 0 ? Math.ceil((weightDiff * kcalPerKg) / goalBurn) - badgeCount : 0;

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
      notificationEnabled,
      notificationHour: parseInt(notificationHour) || 21,
      notificationMinute: parseInt(notificationMinute) || 0,
      mealNotificationEnabled,

      // 🎯 중요한 부분
      goalBurn: goalBurn,
    };

    await AsyncStorage.setItem("user-settings", JSON.stringify(data));

    // 알림 설정 적용
    if (notificationEnabled) {
      const hour = parseInt(notificationHour) || 21;
      const minute = parseInt(notificationMinute) || 0;
      await scheduleDailyNotification(hour, minute);
      Alert.alert(
        "설정 완료",
        `매일 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}에 다이어트 리포트 알림을 받습니다! 💾`
      );
    } else {
      await cancelAllNotifications();
      Alert.alert("설정 완료", "설정이 저장되었습니다! 💾");
    }

    // 식단 알림이 꺼져 있으면 기존 식단 알림 취소
    if (!mealNotificationEnabled) {
      await cancelMealNotifications();
    }

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

  const renderFieldCalendar = (
  label: string,
  value: string,
  setter: (text: string) => void,
  unit: string,
  placeholder: string,
  keyboardType: "numeric" | "default" = "numeric",
  type: "text" | "date" = "text"
) => {
  const [show, setShow] = useState(false);

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`; // 👉 2026-02-21 형식
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>

      {isEditing ? (
        type === "date" ? (
          <>
            <Pressable
              style={styles.input}
              onPress={() => setShow(true)}
            >
              <Text style={{ textAlign: "right" }}>
                {value || placeholder}
              </Text>
            </Pressable>

            {show && (
              <DateTimePicker
                value={value ? new Date(value) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShow(false);
                  if (selectedDate) {
                    setter(formatDate(selectedDate));
                  }
                }}
              />
            )}
          </>
        ) : (
          <TextInput
            style={styles.input}
            keyboardType={keyboardType}
            value={value || ""}
            onChangeText={(text) => setter(text || "")}
            placeholder={placeholder}
          />
        )
      ) : (
        <Text style={styles.viewText}>{value ? value : "-"}</Text>
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
                기본
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
            {/* <TouchableOpacity
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
            </TouchableOpacity> */}
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
              {/* {renderField(
                "다이어트 시작일 :",
                startDate,
                setStartDate,
                "",
                "예: 2024-01-01",
                "default"
              )} */}
              {renderFieldCalendar(
                "다이어트 시작일 :",
                startDate,
                setStartDate,
                "",
                "날짜 선택",
                "default",
                "date"   // 👈 여기 추가
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

            {/* 뱃지 현황 */}
            {!isEditing && startDate && (
              <View style={styles.badgeBox}>
                <Text style={styles.badgeTitle}>✨ 뱃지 현황</Text>
                <View style={styles.badgeContent}>
                  <Text style={styles.badgeCount}>{badgeCount}</Text>
                  <Text style={styles.badgeLabel}>개 획득</Text>
                </View>
                {remainGoalDays > 0 && (
                  <Text style={styles.badgeMessage}>
                    {remainGoalDays}개의 뱃지를 더 모으면 목표 체중({goalWeight}kg)에 달성해요! 💪
                  </Text>
                )}
                {badgeCount >= remainGoalDays && remainGoalDays > 0 && (
                  <Text style={styles.badgeSuccess}>
                    축하합니다! 목표를 달성했습니다! 🎉
                  </Text>
                )}
              </View>
            )}

            {/* 화면 설정 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>화면 설정</Text>
              {renderWeeklyViewModePicker()}
            </View>

            {/* 알림 설정 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>알림 설정</Text>

              {/* 알림 활성화 토글 */}
              <View style={styles.row}>
                <Text style={styles.label}>리포트 알림 :</Text>
                {isEditing ? (
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        notificationEnabled && styles.toggleButtonActive,
                      ]}
                      onPress={() => setNotificationEnabled(!notificationEnabled)}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          notificationEnabled && styles.toggleTextActive,
                        ]}
                      >
                        {notificationEnabled ? "켜기" : "끄기"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.viewText}>
                    {notificationEnabled ? "켜짐" : "꺼짐"}
                  </Text>
                )}
              </View>

              {/* 알림 시간 설정 */}
              {notificationEnabled && (
                <View style={styles.row}>
                  <Text style={styles.label}>알림 시간 :</Text>
                  {isEditing ? (
                    <View style={styles.timeContainer}>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="numeric"
                        value={notificationHour}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 0;
                          if (num >= 0 && num <= 23) {
                            setNotificationHour(text);
                          }
                        }}
                        placeholder="21"
                        maxLength={2}
                      />
                      <Text style={styles.timeColon}>:</Text>
                      <TextInput
                        style={styles.timeInput}
                        keyboardType="numeric"
                        value={notificationMinute}
                        onChangeText={(text) => {
                          const num = parseInt(text) || 0;
                          if (num >= 0 && num <= 59) {
                            setNotificationMinute(text);
                          }
                        }}
                        placeholder="00"
                        maxLength={2}
                      />
                    </View>
                  ) : (
                    <Text style={styles.viewText}>
                      {String(notificationHour).padStart(2, "0")}:{String(notificationMinute).padStart(2, "0")}
                    </Text>
                  )}
                </View>
              )}

              {/* 테스트 알림 버튼 
              {!isEditing && notificationEnabled && (
                <TouchableOpacity
                  style={styles.testNotificationButton}
                  onPress={async () => {
                    await sendTestNotification();
                    Alert.alert("테스트 알림", "알림이 전송되었습니다!");
                  }}
                >
                  <Text style={styles.testNotificationText}>📱 테스트 알림 보내기</Text>
                </TouchableOpacity>
              )}*/}

              {/* 식단 알림 토글 */}
              <View style={styles.row}>
                <Text style={styles.label}>식단 알림 :</Text>
                {isEditing ? (
                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        mealNotificationEnabled && styles.toggleButtonActive,
                      ]}
                      onPress={() => setMealNotificationEnabled(!mealNotificationEnabled)}
                    >
                      <Text
                        style={[
                          styles.toggleText,
                          mealNotificationEnabled && styles.toggleTextActive,
                        ]}
                      >
                        {mealNotificationEnabled ? "켜기" : "끄기"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.viewText}>
                    {mealNotificationEnabled ? "켜짐" : "꺼짐"}
                  </Text>
                )}
              </View>

              {mealNotificationEnabled && !isEditing && (
                <Text style={styles.mealNotificationInfo}>
                  계획된 식단이 있다면 아침 9시, 점심 12시, 저녁 18시에 알려드려요!
                </Text>
              )}
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

  badgeBox: {
    backgroundColor: "#FFF9E6",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  badgeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF7FA0",
    marginBottom: 15,
    textAlign: "center",
  },
  badgeContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    marginBottom: 15,
  },
  badgeCount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFD700",
    marginRight: 8,
  },
  badgeLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF7FA0",
  },
  badgeMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
  },
  badgeSuccess: {
    fontSize: 16,
    color: "#4CAF50",
    textAlign: "center",
    fontWeight: "700",
    marginTop: 10,
  },

  toggleContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: pink,
    borderRadius: 8,
    backgroundColor: "#FFF",
  },
  toggleButtonActive: {
    backgroundColor: deepPink,
    borderColor: deepPink,
  },
  toggleText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "#FFF",
    fontWeight: "700",
  },

  timeContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  timeInput: {
    width: 50,
    borderWidth: 1,
    borderColor: pink,
    borderRadius: 8,
    height: 35,
    paddingHorizontal: 8,
    textAlign: "center",
    backgroundColor: "#FFF",
    fontSize: 16,
  },
  timeColon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginHorizontal: 5,
  },

  testNotificationButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  testNotificationText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  mealNotificationInfo: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    marginLeft: 10,
    fontStyle: "italic",
  },
});
