import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * 알림 권한 요청
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
};

/**
 * 오늘의 목표 달성 여부 확인
 */
const checkTodayGoal = async (): Promise<{
  goalAchieved: boolean;
  badgeEarned: boolean;
  totalIntake: number;
  goalIntake: number;
  actualBurn: number;
  goalBurn: number;
}> => {
  try {
    const settingsRaw = await AsyncStorage.getItem("user-settings");
    if (!settingsRaw) {
      return {
        goalAchieved: false,
        badgeEarned: false,
        totalIntake: 0,
        goalIntake: 0,
        actualBurn: 0,
        goalBurn: 0,
      };
    }

    const settings = JSON.parse(settingsRaw);
    const { bmr, exercise, intake, goalBurn } = settings;

    const today = new Date();
    const dateStr = formatDate(today);

    // 오늘의 식사 데이터 가져오기
    const mealsRaw = await AsyncStorage.getItem(`meals-${dateStr}`);
    let totalIntake = 0;

    if (mealsRaw) {
      const parsed = JSON.parse(mealsRaw);
      totalIntake = Object.values(parsed)
        .flat()
        .reduce((s: number, m: any) => s + (m.kcal || 0), 0);
    }

    // 오늘의 운동 칼로리 가져오기
    const exerciseRaw = await AsyncStorage.getItem(`exercise-${dateStr}`);
    const dailyExercise = exerciseRaw ? JSON.parse(exerciseRaw) : 0;

    // 실제 소모량 계산
    const actualBurn = totalIntake - (bmr + exercise + dailyExercise);

    // 목표 달성 여부
    const goalAchieved = totalIntake <= intake;
    const badgeEarned = actualBurn <= -goalBurn;

    return {
      goalAchieved,
      badgeEarned,
      totalIntake,
      goalIntake: intake,
      actualBurn,
      goalBurn,
    };
  } catch (error) {
    console.error("목표 확인 중 오류:", error);
    return {
      goalAchieved: false,
      badgeEarned: false,
      totalIntake: 0,
      goalIntake: 0,
      actualBurn: 0,
      goalBurn: 0,
    };
  }
};

/**
 * 매일 반복 알림 스케줄링
 */
export const scheduleDailyNotification = async (
  hour: number,
  minute: number
): Promise<void> => {
  try {
    // 기존 알림 모두 취소
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 권한 확인
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log("알림 권한이 없습니다.");
      return;
    }

    // 매일 반복 알림 설정
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📊 오늘의 다이어트 리포트",
        body: "오늘의 목표 달성 여부를 확인해보세요!",
        data: { type: "daily-report" },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    console.log(`매일 ${hour}:${minute}에 알림이 설정되었습니다.`);
  } catch (error) {
    console.error("알림 스케줄링 중 오류:", error);
  }
};

/**
 * 즉시 테스트 알림 전송
 */
export const sendTestNotification = async (): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log("알림 권한이 없습니다.");
      return;
    }

    const result = await checkTodayGoal();

    let title = "📊 오늘의 다이어트 리포트";
    let body = "";

    if (result.badgeEarned) {
      body = `축하합니다! 오늘 목표를 달성하여 뱃지를 획득했습니다! ✨\n섭취: ${result.totalIntake}kcal / 목표: ${result.goalIntake}kcal`;
    } else if (result.goalAchieved) {
      body = `섭취 목표는 달성했지만, 뱃지를 얻으려면 조금 더 노력이 필요해요!\n섭취: ${result.totalIntake}kcal / 목표: ${result.goalIntake}kcal`;
    } else {
      body = `오늘은 목표를 달성하지 못했습니다. 내일 다시 도전해보세요! 💪\n섭취: ${result.totalIntake}kcal / 목표: ${result.goalIntake}kcal`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: "daily-report", ...result },
      },
      trigger: null, // 즉시 전송
    });
  } catch (error) {
    console.error("테스트 알림 전송 중 오류:", error);
  }
};

/**
 * 모든 알림 취소
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * 식단 알림 스케줄링 (아침 9시, 점심 12시, 저녁 18시)
 */
export const scheduleMealNotifications = async (
  date: string,
  breakfastMeals: any[],
  lunchMeals: any[],
  dinnerMeals: any[]
): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log("알림 권한이 없습니다.");
      return;
    }

    // 오늘 날짜인지 확인
    const today = formatDate(new Date());
    if (date !== today) {
      return; // 오늘 날짜가 아니면 알림 설정 안 함
    }

    // 설정에서 식단 알림이 켜져 있는지 확인
    const settingsRaw = await AsyncStorage.getItem("user-settings");
    if (!settingsRaw) {
      return;
    }

    const settings = JSON.parse(settingsRaw);
    if (!settings.mealNotificationEnabled) {
      return; // 식단 알림이 꺼져 있으면 스케줄링 안 함
    }

    const now = new Date();
    const currentHour = now.getHours();

    // 기존 식단 알림 취소 (태그로 식별)
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (
        notification.content.data?.type === "meal-breakfast" ||
        notification.content.data?.type === "meal-lunch" ||
        notification.content.data?.type === "meal-dinner"
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    // 아침 식단 알림 (9시, 이미 지나지 않았을 때만)
    if (breakfastMeals.length > 0 && currentHour < 9) {
      const breakfastMealNames = breakfastMeals
        .filter((m) => m.name)
        .map((m) => m.name)
        .join(", ");

      if (breakfastMealNames) {
        const breakfastTime = new Date();
        breakfastTime.setHours(9, 0, 0, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🌅 아침 식단 알림",
            body: `오늘 아침은 ${breakfastMealNames} 계획되어 있습니다!`,
            data: { type: "meal-breakfast", date },
          },
          trigger: breakfastTime,
        });

        console.log(`아침 식단 알림이 9시에 설정되었습니다: ${breakfastMealNames}`);
      }
    }

    // 점심 식단 알림 (12시, 이미 지나지 않았을 때만)
    if (lunchMeals.length > 0 && currentHour < 12) {
      const lunchMealNames = lunchMeals
        .filter((m) => m.name)
        .map((m) => m.name)
        .join(", ");

      if (lunchMealNames) {
        const lunchTime = new Date();
        lunchTime.setHours(12, 0, 0, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🍱 점심 식단 알림",
            body: `오늘 점심은 ${lunchMealNames} 계획되어 있습니다!`,
            data: { type: "meal-lunch", date },
          },
          trigger: lunchTime,
        });

        console.log(`점심 식단 알림이 12시에 설정되었습니다: ${lunchMealNames}`);
      }
    }

    // 저녁 식단 알림 (18시, 이미 지나지 않았을 때만)
    if (dinnerMeals.length > 0 && currentHour < 18) {
      const dinnerMealNames = dinnerMeals
        .filter((m) => m.name)
        .map((m) => m.name)
        .join(", ");

      if (dinnerMealNames) {
        const dinnerTime = new Date();
        dinnerTime.setHours(18, 0, 0, 0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🍽️ 저녁 식단 알림",
            body: `오늘 저녁은 ${dinnerMealNames} 계획되어 있습니다!`,
            data: { type: "meal-dinner", date },
          },
          trigger: dinnerTime,
        });

        console.log(`저녁 식단 알림이 18시에 설정되었습니다: ${dinnerMealNames}`);
      }
    }
  } catch (error) {
    console.error("식단 알림 스케줄링 중 오류:", error);
  }
};

/**
 * 식단 알림 취소
 */
export const cancelMealNotifications = async (): Promise<void> => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (
        notification.content.data?.type === "meal-breakfast" ||
        notification.content.data?.type === "meal-lunch" ||
        notification.content.data?.type === "meal-dinner"
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    console.log("식단 알림이 취소되었습니다.");
  } catch (error) {
    console.error("식단 알림 취소 중 오류:", error);
  }
};
