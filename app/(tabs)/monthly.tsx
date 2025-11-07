import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const KR_WEEK = ["월","화","수","목","금","토","일"];
const { width } = Dimensions.get("window");
const GAP = 2;
const CELL_SIZE = Math.floor((width - 2 * 10 - GAP * 6) / 7); // 좌우 padding 10, 칸 사이 GAP 고려

const formatDate = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,"0"); const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
};

interface Meal { name: string; kcal: number; }

export default function MonthlyScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [cells, setCells] = useState<{ empty?: boolean; date?: string; total?: number }[]>([]);
  const router = useRouter();
  const [subKcal, setSubKcal] = useState<number>(0);  // 현재까지 소모칼로리 

  //TODO: MyPage 임시, 이걸 설정페이지에서 입력받아 AsyncStorage에 담아야함.
  const bmf = 1100;   // 기초대사량 
  const startWeight = 48;
  const goalWeight = 43;
  const goalFoodKcal = 800;
  const goalExKcal = 200;
  const goalSubKcal = bmf - goalFoodKcal + goalExKcal;
  // 현재까지 소모된 칼로리로 보는 예상 체중
  const estWeight = Math.round((startWeight - (subKcal / 770 * 0.1)) * 10) / 10;     
  const truncWeight = Math.trunc(estWeight - 0.1);   // 가장 직면한 몸무게 
  const remainTrun = Math.trunc((estWeight - truncWeight) * 7700 / goalSubKcal);
  const remainGoal = Math.trunc((estWeight - goalWeight) * 7700 / goalSubKcal);

  const buildMonth = async (base: Date) => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    // 월요일 시작 인덱스(0~6)
    const startPad = (first.getDay() + 6) % 7;
    let sub = 0;
    const arr: { empty?: boolean; date?: string; total?: number }[] = [];
    for (let i = 0; i < startPad; i++) arr.push({ empty: true });

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(year, month, day); // 로컬 날짜
      const key = formatDate(d);
      const raw = await AsyncStorage.getItem(`meals-${key}`);
      const total = raw ? Object.values(JSON.parse(raw)).flat()
        .reduce((s: number, m: any) => s + (m.kcal || 0), 0) : 0;
      arr.push({ date: key, total });
      if (total > 0) {
        sub += bmf - total;
      }
    }
    setSubKcal(sub);

    // 7의 배수로 채우기
    while (arr.length % 7 !== 0) arr.push({ empty: true });

    setCells(arr);
  };

  useEffect(() => { buildMonth(currentMonth); }, [currentMonth]);
  useEffect(() => { buildMonth(currentMonth); }, [AsyncStorage]);

  const changeMonth = (off: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + off);
    setCurrentMonth(d);
  };

  const colorOf = (k: number = 0) => {
    if (k === 0) return "#fff";
    if (k <= goalFoodKcal) return "#FFE4EC";
    if (k < 1800) return "#F8BBD0";
    return "#F48FB1";
  };

  return (
    
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={styles.nav}>◀</Text></TouchableOpacity>
        <Text style={styles.title}>{currentMonth.getFullYear()}년 {currentMonth.getMonth()+1}월</Text>
        <TouchableOpacity onPress={() => changeMonth(1)}><Text style={styles.nav}>▶</Text></TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {KR_WEEK.map((w) => (<Text key={w} style={styles.weekItem}>{w}</Text>))}
      </View>

      <View style={styles.grid}>
        {cells.map((c, i) => (
          <TouchableOpacity
            key={i}
            disabled={c.empty}
            style={[styles.cell, { backgroundColor: c.empty ? "transparent" : colorOf(c.total!) }]}
            onPress={() => c.date && router.push(`/(tabs)/daily?date=${c.date}`)}
          >
            {!c.empty && (
              <>
                <Text style={styles.day}>{new Date(c.date!).getDate()}</Text>
                {c.total! > 0 && <Text style={styles.kcal}>{c.total}kcal</Text>}
              </>
            )}
          </TouchableOpacity>
        ))}
      
      </View>
      {/* <Text style={styles.repTitle}>리포트 </Text> */}
      {/* 아래 그리드 형태로 예쁘게 */}
      <Text style={styles.repTitle}>지금까지 소모한 칼로리    -{subKcal} Kcal</Text>
      <Text style={styles.repTitle}>현재 예상 몸무게     {estWeight} kg</Text>
      <Text style={styles.repTitle}>{truncWeight} kg 까지     D - {remainTrun}</Text>
      <Text style={styles.repTitle}>{goalWeight} kg 까지     D - {remainGoal}</Text>
    </SafeAreaView>
  );
}

const pink = "#FFD6E0"; const deepPink = "#FFB6C1";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8", paddingHorizontal: 10, paddingTop: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  nav: { fontSize: 20, color: "#FF7FA0", fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", color: "#FF80A0" },
  weekHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  weekItem: { width: CELL_SIZE, textAlign: "center", color: "#FF7FA0", fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start", // ✅ 가운데 밀림 방지
    columnGap: GAP, rowGap: GAP,
  },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderRadius: 6, alignItems: "center", justifyContent: "center",
  },
  day: { fontWeight: "700", color: "#333", fontSize: 14 },
  kcal: { fontSize: 10, color: "#FF7FA0", fontWeight: "600" },
  repTitle: { bottom: -20, fontSize: 20, fontWeight: "700", color: "#FF80A0", textAlign: "center"},
  report: { textAlign: "center", bottom: -20, fontSize: 14, fontWeight: "700"}
});
