import AsyncStorage from "@react-native-async-storage/async-storage";

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/**
 * 특정 날짜의 뱃지 수여 여부 확인
 */
export const checkBadgeForDate = async (dateStr: string): Promise<boolean> => {
  const badgeData = await AsyncStorage.getItem(`badge-${dateStr}`);
  return badgeData === "true";
};

/**
 * 특정 날짜에 뱃지 수여
 */
export const awardBadge = async (dateStr: string): Promise<void> => {
  await AsyncStorage.setItem(`badge-${dateStr}`, "true");
};

/**
 * 특정 날짜의 뱃지 회수
 */
export const revokeBadge = async (dateStr: string): Promise<void> => {
  await AsyncStorage.removeItem(`badge-${dateStr}`);
};

/**
 * 다이어트 시작일부터 오늘까지 뱃지 체크 및 자동 수여
 * 목표 소모 칼로리를 초과한 날에 자동으로 뱃지 수여
 */
export const checkAndAwardBadges = async (): Promise<void> => {
  try {
    const settingsRaw = await AsyncStorage.getItem("user-settings");
    if (!settingsRaw) return;

    const settings = JSON.parse(settingsRaw);
    const { startDate, bmr, exercise, goalBurn } = settings;

    if (!startDate || !goalBurn || goalBurn <= 0) return;

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 다이어트 시작일부터 오늘까지 순회
    const current = new Date(start);
    while (current <= today) {
      const dateStr = formatDate(current);

      // 해당 날짜의 식사 데이터 가져오기
      const mealsRaw = await AsyncStorage.getItem(`meals-${dateStr}`);
      let totalIntake = 0;

      if (mealsRaw) {
        const parsed = JSON.parse(mealsRaw);
        totalIntake = Object.values(parsed)
          .flat()
          .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
      }

      // 운동 칼로리 가져오기
      const exerciseRaw = await AsyncStorage.getItem(`exercise-${dateStr}`);
      const dailyExercise = exerciseRaw ? JSON.parse(exerciseRaw) : 0;

      // 실제 소모량 계산: 섭취 - (기초대사량 + 기본운동 + 추가운동)
      const actualBurn = totalIntake - (bmr + dailyExercise);

      // 이미 뱃지가 수여되었는지 확인
      const alreadyAwarded = await checkBadgeForDate(dateStr);

      // 목표 소모 칼로리: 음수여야 함 (칼로리 적자 목표)
      // actualBurn이 목표(음수)보다 작으면(더 많이 소모) 성공
      if (actualBurn <= -goalBurn) {
        // 조건을 만족하면 뱃지 수여
        if (!alreadyAwarded) {
          await awardBadge(dateStr);
        }
      } else {
        
        // 조건을 만족하지 못하면 뱃지 회수
        if (alreadyAwarded) {
          await revokeBadge(dateStr);
        }
      }

      current.setDate(current.getDate() + 1);
    }
  } catch (error) {
    console.error("뱃지 체크 중 오류:", error);
  }
};

/**
 * 다이어트 시작일부터 오늘까지 획득한 뱃지 개수 계산
 */
export const countBadges = async (): Promise<number> => {
  try {
    const settingsRaw = await AsyncStorage.getItem("user-settings");
    if (!settingsRaw) return 0;

    const settings = JSON.parse(settingsRaw);
    const { startDate } = settings;

    if (!startDate) return 0;

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let count = 0;
    const current = new Date(start);

    while (current <= today) {
      const dateStr = formatDate(current);
      const hasBadge = await checkBadgeForDate(dateStr);
      if (hasBadge) count++;
      current.setDate(current.getDate() + 1);
    }

    return count;
  } catch (error) {
    console.error("뱃지 개수 계산 중 오류:", error);
    return 0;
  }
};

/**
 * 어제 날짜의 리포트 생성 (앱 열 때 체크용)
 */
export const getYesterdayReport = async (): Promise<{
  date: string;
  success: boolean;
  actualBurn: number;
  goalBurn: number;
  message: string;
} | null> => {
  try {
    const settingsRaw = await AsyncStorage.getItem("user-settings");
    if (!settingsRaw) return null;

    const settings = JSON.parse(settingsRaw);
    const { bmr, exercise, goalBurn, startDate } = settings;

    if (!goalBurn || goalBurn <= 0) return null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // 다이어트 시작일 이후인지 확인
    if (startDate) {
      const start = new Date(startDate);
      if (yesterday < start) return null;
    }

    const dateStr = formatDate(yesterday);

    // 식사 데이터 가져오기
    const mealsRaw = await AsyncStorage.getItem(`meals-${dateStr}`);
    let totalIntake = 0;

    if (mealsRaw) {
      const parsed = JSON.parse(mealsRaw);
      totalIntake = Object.values(parsed)
        .flat()
        .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
    }

    // 운동 칼로리 가져오기
    const exerciseRaw = await AsyncStorage.getItem(`exercise-${dateStr}`);
    const dailyExercise = exerciseRaw ? JSON.parse(exerciseRaw) : 0;

    // 실제 소모량 계산
    const actualBurn = totalIntake - (bmr + exercise + dailyExercise);
    const success = actualBurn <= -goalBurn;

    const message = success
      ? `축하합니다! 어제 목표를 달성하여 뱃지를 획득했습니다! 🎉`
      : `아쉽게도 어제는 목표를 달성하지 못했습니다. 오늘 다시 도전해보세요! 💪`;

    return {
      date: dateStr,
      success,
      actualBurn,
      goalBurn,
      message,
    };
  } catch (error) {
    console.error("어제 리포트 생성 중 오류:", error);
    return null;
  }
};
