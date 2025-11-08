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

  // ✅ 설정 불러오기 (탭을 다시 열 때마다 자동 실행)
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
        }
      })();
    }, [])
  );

  const totalBurn = Math.max(
    0,
    (parseInt(intake) || 0) - (parseInt(exercise) || 0)
  );

  const saveSettings = async () => {
    const data = {
      weight,
      targetWeight,
      bmr: parseInt(bmr) || 0,
      intake: parseInt(intake) || 0,
      exercise: parseInt(exercise) || 0,
    };
    await AsyncStorage.setItem("user-settings", JSON.stringify(data));
    alert("설정이 저장되었습니다! 💾");
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
            {/* 👤 헤더 */}
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

            {/* 📦 기본 정보 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>기본 정보</Text>

              <View style={styles.row}>
                <Text style={styles.label}>현재 몸무게 :</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  placeholder="예: 60"
                />
                <Text style={styles.unit}>kg</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>목표 몸무게 :</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  placeholder="예: 55"
                />
                <Text style={styles.unit}>kg</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>기초대사량 :</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={bmr}
                  onChangeText={setBmr}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  placeholder="예: 1500"
                />
                <Text style={styles.unit}>kcal</Text>
              </View>
            </View>

            {/* 🎯 목표 섹션 */}
            <View style={styles.box}>
              <Text style={styles.sectionTitle}>목표</Text>

              <View style={styles.row}>
                <Text style={styles.label}>섭취 칼로리 :</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={intake}
                  onChangeText={setIntake}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  placeholder="예: 1800"
                />
                <Text style={styles.unit}>kcal</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>운동 칼로리 :</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={exercise}
                  onChangeText={setExercise}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  placeholder="예: 300"
                />
                <Text style={styles.unit}>kcal</Text>
              </View>

              <View style={[styles.row, styles.totalRow]}>
                <Text style={[styles.label, { color: "#333" }]}>
                  소모 칼로리 :
                </Text>
                <Text style={styles.totalValue}>{totalBurn} kcal</Text>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* 💾 저장 버튼 */}
      <TouchableOpacity onPress={saveSettings} style={styles.saveButton}>
        <Text style={styles.saveText}>💾 저장하기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF5F8",
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },
  profileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFD6E0",
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
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FF80A0",
  },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    flex: 1.2,
    fontSize: 16,
    color: "#444",
    fontWeight: "500",
  },
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
  unit: {
    width: 40,
    textAlign: "left",
    fontSize: 15,
    color: "#888",
  },
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
  saveButton: {
    backgroundColor: "#FFB6C1",
    borderRadius: 10,
    alignSelf: "center",
    paddingHorizontal: 30,
    paddingVertical: 10,
    marginBottom: 30,
  },
  saveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
