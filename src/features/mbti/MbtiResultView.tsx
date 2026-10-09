import { Image } from "expo-image";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, EmptyView, LoadingView, Screen, TopBar } from "@/components/ui";
import { useMbtiStore } from "@/store/mbti";
import { colors, fonts, motion, radius, screenPadding, space } from "@/theme";

import { MBTI_IMAGES, MBTI_PROFILES } from "./profiles";
import { useMbtiHydrated } from "./useMbtiHydrated";

const CHARACTER = 214;
const enter = (i: number) => FadeInDown.delay(180 + motion.stagger * i).springify().damping(motion.spring.gentle.damping);

const goBack = () => (router.canGoBack() ? router.back() : router.navigate("/my"));

/** 피그마 B · 성향 결과 (400:1385) — TriPin/Profile/Result Template */
export function MbtiResultView() {
  const hydrated = useMbtiHydrated();
  const result = useMbtiStore((s) => s.result);

  if (!hydrated || !result) {
    return (
      <Screen>
        <TopBar title="나의 여행 성향" onBack={goBack} />
        {!hydrated ? (
          <LoadingView />
        ) : (
          <EmptyView
            title="아직 검사 결과가 없어요"
            description="12개의 질문으로 나의 여행 성향을 알아봐요."
            actionLabel="검사 시작하기"
            onAction={() => router.replace("/my/mbti")}
          />
        )}
      </Screen>
    );
  }

  const profile = MBTI_PROFILES[result.type];
  // S2에서 고른 경험 태그가 있으면 "선호 장소"에 그대로 보여 줍니다
  const rows: [string, string][] = [
    ["여행 속도", profile.pace],
    ["선호 장소", result.preferenceTags.length ? result.preferenceTags.join(" · ") : profile.places],
    ["좋아하는 활동", profile.activities],
    ["잘 맞는 동행", profile.companions],
  ];
  if (result.exclusionTags.length) rows.push(["피하고 싶은 것", result.exclusionTags.join(" · ")]);

  return (
    <Screen>
      <TopBar title="나의 여행 성향" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={ZoomIn.springify().damping(motion.spring.bouncy.damping).stiffness(motion.spring.bouncy.stiffness)} style={styles.character}>
          <Image
            source={MBTI_IMAGES[result.type]}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={`${result.type} ${profile.name} 캐릭터`}
          />
        </Animated.View>

        <Animated.View entering={enter(0)} style={styles.nameBlock}>
          <View style={styles.typeChip}>
            <AppText variant="caption" color="darkgreen" style={styles.typeText}>
              {result.type}
            </AppText>
          </View>
          <AppText variant="resultName" align="center" accessibilityRole="header">
            {profile.name}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <AppText variant="bodyMedium15" align="center">
            {profile.summary.join("\n")}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(2)}>
          <AppText variant="small13" color="muted" align="center">
            {profile.description.join("\n")}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(3)} style={styles.traits}>
          {profile.traits.map((trait) => (
            <View key={trait} style={styles.trait}>
              <AppText variant="caption" color="darkgreen" style={styles.traitText}>
                {`#${trait}`}
              </AppText>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={enter(4)} style={styles.summary}>
          <AppText variant="small13Bold">나의 여행 취향 한눈에</AppText>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <AppText variant="small12" color="muted" style={styles.rowLabel}>
                {label}
              </AppText>
              <AppText variant="small13Medium" style={styles.rowValue}>
                {value}
              </AppText>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <BottomCTA helper="설문 다시 하기" onHelperPress={() => router.replace("/my/mbti")}>
        <Button label="이 성향으로 여행 준비하기" rightIcon={<Icons.ArrowRight width={20} height={20} />} onPress={() => router.navigate("/")} />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[4], paddingBottom: space[24], gap: 10, alignItems: "center" },
  character: { width: CHARACTER, height: CHARACTER },
  image: { width: CHARACTER, height: CHARACTER },
  nameBlock: { alignItems: "center", gap: space[4] },
  typeChip: { minWidth: 56, height: 18, paddingHorizontal: space[8], borderRadius: radius.sm, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  // 피그마 Bold 12
  typeText: { fontFamily: fonts.bold, lineHeight: 16 },
  traits: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space[8] },
  trait: { paddingHorizontal: 10, paddingVertical: space[4], borderRadius: radius.sm, backgroundColor: colors.mint },
  // 피그마 Medium 12/20
  traitText: { lineHeight: 20 },
  summary: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space[16], paddingVertical: space[12], gap: space[4] },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2 },
  rowLabel: { width: 84, paddingTop: 1 },
  rowValue: { flex: 1 },
});
