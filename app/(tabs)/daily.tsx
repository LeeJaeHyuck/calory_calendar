import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";

interface Meal { name: string; kcal: number; }
interface Meals { Breakfast: Meal[]; Lunch: Meal[]; Dinner: Meal[]; }

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function DailyScreen() {
  const params = useLocalSearchParams();
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [meals, setMeals] = useState<Meals>({
    Breakfast: [{ name: "", kcal: 0 }],
    Lunch: [{ name: "", kcal: 0 }],
    Dinner: [{ name: "", kcal: 0 }],
  });
  const [isSaved, setIsSaved] = useState(false);

  // ✅ 날짜 변경 시 param 반영
  useFocusEffect(
    useCallback(() => {
      if (params?.date) setDate(String(params.date));
    }, [params?.date])
  );

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(`meals-${date}`);
      if (saved) setMeals(JSON.parse(saved));
      else setMeals({
        Breakfast: [{ name: "", kcal: 0 }],
        Lunch: [{ name: "", kcal: 0 }],
        Dinner: [{ name: "", kcal: 0 }],
      });
      setIsSaved(false);
    })();
  }, [date]);

  const updateMeal = (type: keyof Meals, index: number, key: keyof Meal, value: string) => {
    const updated = { ...meals };
    updated[type][index][key] = key === "kcal" ? parseInt(value) || 0 : (value as any);
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

  const saveMeals = async () => {
    await AsyncStorage.setItem(`meals-${date}`, JSON.stringify(meals));
    setIsSaved(true);
  };

  const total = Object.values(meals).flat().reduce((s, m) => s + (m.kcal || 0), 0);

  const changeDay = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(formatDate(d));
  };

  const goToday = () => setDate(formatDate(new Date()));

  // ✅ 식사별 소계 포함
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

        <TouchableOpacity onPress={() => addMeal(type)} style={styles.addButton}>
          <Text style={styles.addText}>+ 추가</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => changeDay(-1)}><Text style={styles.navBtn}>◀</Text></TouchableOpacity>
          <Text style={styles.title}>🍓 {date}</Text>
          <TouchableOpacity onPress={() => changeDay(1)}><Text style={styles.navBtn}>▶</Text></TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToday} style={styles.todayButton}>
          <Text style={styles.todayText}>오늘로 이동</Text>
        </TouchableOpacity>

        <FlatList
          data={Object.keys(meals) as (keyof Meals)[]}
          renderItem={({ item }) => renderMeal(item)}
          keyExtractor={(item) => item}
        />

        <Text style={styles.total}>Total: {total} kcal</Text>

        <TouchableOpacity onPress={saveMeals} style={[styles.saveButton, isSaved && { backgroundColor: "#F8BBD0" }]}>
          <Text style={styles.saveText}>{isSaved ? "✅ 저장됨" : "💾 저장하기"}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0";
const deepPink = "#FFB6C1";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  navBtn: { fontSize: 28, color: "#FF7FA0", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#FF80A0" },
  todayButton: { backgroundColor: deepPink, paddingVertical: 6, borderRadius: 20, alignSelf: "center", marginBottom: 10, paddingHorizontal: 20 },
  todayText: { color: "#fff", fontWeight: "600" },
  mealSection: { marginBottom: 20, backgroundColor: "#fff", borderRadius: 16, padding: 15, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  mealTitle: { fontSize: 18, fontWeight: "600", color: "#FF7FA0" },
  mealTotal: { fontSize: 16, fontWeight: "600", color: "#FF7FA0" },
  foodRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  foodInput: { flex: 2, borderWidth: 1, borderColor: "#FFD6E0", borderRadius: 8, paddingHorizontal: 8, height: 36, marginRight: 6 },
  kcalInput: { width: 70, borderWidth: 1, borderColor: "#FFD6E0", borderRadius: 8, paddingHorizontal: 8, height: 36, marginRight: 6 },
  delete: { fontSize: 20, color: "#FF9AB5" },
  addButton: { backgroundColor: pink, padding: 6, borderRadius: 6, alignItems: "center", marginTop: 5, width: 80 },
  addText: { color: "#FF6295", fontWeight: "600" },
  total: { fontSize: 14, fontWeight: "700", textAlign: "right", marginTop: 15 },
  saveButton: { position: "absolute", bottom: -10, alignSelf: "center", backgroundColor: deepPink, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 5 },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
