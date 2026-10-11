import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { AppText } from "@/components/ui";
import { colors, fonts, motion, radius, space } from "@/theme";

import { MBTI_IMAGES, MBTI_PROFILES } from "./profiles";
import type { MbtiType } from "./types";

const CHARACTER = 214;
const enter = (i: number) => FadeInDown.delay(180 + motion.stagger * i).springify().damping(motion.spring.gentle.damping);

type Props = {
  type: MbtiType;
  /** "나의 여행 취향 한눈에" 표 아래에 덧붙일 줄 (예: 피하고 싶은 것) */
  extraRows?: [string, string][];
  /** 표 아래에 이어 붙일 내용 (예: 온보딩 취향 요약) */
  children?: ReactNode;
};

/** 피그마 B · 성향 결과 (400:1385, TriPin/Profile/Result Template) 본문. 스크롤 컨테이너는 화면이 감쌉니다. */
export function MbtiProfileView({ type, extraRows = [], children }: Props) {
  const profile = MBTI_PROFILES[type];
  const rows: [string, string][] = [
    ["여행 속도", profile.pace],
    ["선호 장소", profile.places],
    ["좋아하는 활동", profile.activities],
    ["잘 맞는 동행", profile.companions],
    ...extraRows.filter(([, value]) => !!value),
  ];

  return (
    <View style={styles.wrap}>
      <Animated.View entering={ZoomIn.springify().damping(motion.spring.bouncy.damping).stiffness(motion.spring.bouncy.stiffness)} style={styles.character}>
        <Image source={MBTI_IMAGES[type]} style={styles.image} contentFit="contain" accessibilityLabel={`${type} ${profile.name} 캐릭터`} />
      </Animated.View>

      <Animated.View entering={enter(0)} style={styles.nameBlock}>
        <View style={styles.typeChip}>
          <AppText variant="caption" color="darkgreen" style={styles.typeText}>
            {type}
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

      {children ? <Animated.View entering={enter(5)} style={styles.extra}>{children}</Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, alignItems: "center" },
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
  extra: { alignSelf: "stretch" },
});
