import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { onboardingApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, PressableScale } from "@/components/ui";
import { MBTI_IMAGES, MBTI_PROFILES } from "@/features/mbti/profiles";
import { isMbtiType, type MbtiType } from "@/features/mbti/types";
import { Skeleton } from "@/features/trip/components/Skeleton";
import { colors, radius, space } from "@/theme";

type Variant = "home" | "my";

/** 내 여행 성향(서버 mbtiCode). 설문 v1·설문 전이면 null */
export function useMyPersona() {
  const onboarding = useQuery({ queryKey: queryKeys.myOnboarding, queryFn: onboardingApi.me });
  const code = onboarding.data?.submission?.mbtiCode;
  return { type: isMbtiType(code) ? code : null, isPending: onboarding.isPending };
}

/**
 * "나의 여행 성향" 카드 — 홈(피그마 A1, 흰 카드)과 MY(초안 M1, 민트 카드) 두 모양.
 * 성향 콘텐츠는 백엔드 travel-personas.json을 복사한 프론트 상수입니다.
 */
export function PersonaCard({ variant }: { variant: Variant }) {
  const { type, isPending } = useMyPersona();
  if (isPending) return <PersonaSkeleton variant={variant} />;
  if (!type) return <NoPersona variant={variant} />;
  return variant === "home" ? <HomePersona type={type} /> : <MyPersona type={type} />;
}

function HomePersona({ type }: { type: MbtiType }) {
  const profile = MBTI_PROFILES[type];
  return (
    <View style={styles.homeCard}>
      <PressableScale
        onPress={() => router.push("/my/persona")}
        scaleTo={0.98}
        style={styles.homeTop}
        accessibilityRole="button"
        accessibilityLabel={`나의 여행 성향, ${type} ${profile.name}`}
        accessibilityHint="성향 결과를 자세히 봐요"
      >
        <View style={styles.homeTexts}>
          <AppText variant="small12" color="muted">
            나의 여행 성향
          </AppText>
          <AppText variant="small13Bold" color="blue" style={styles.code}>
            {type}
          </AppText>
          <AppText variant="cardTitle" style={styles.name}>
            {profile.name}
          </AppText>
          <AppText variant="small12" color="muted" numberOfLines={1}>
            {profile.hashtags.slice(0, 3).map((t) => `#${t}`).join("  ")}
          </AppText>
        </View>
        <Image source={MBTI_IMAGES[type]} style={styles.homeImage} contentFit="contain" accessibilityIgnoresInvertColors />
      </PressableScale>
      <View style={styles.homeActions}>
        <PressableScale onPress={() => router.push("/my/persona")} style={styles.link} accessibilityRole="button" accessibilityLabel="내 성향 보기">
          <AppText variant="small13Medium" color="darkgreen">
            내 성향 보기 ›
          </AppText>
        </PressableScale>
        <Button label="성향검사 다시하기" variant="secondary" height={44} onPress={() => router.push("/survey")} style={styles.retake} />
      </View>
    </View>
  );
}

function MyPersona({ type }: { type: MbtiType }) {
  const profile = MBTI_PROFILES[type];
  return (
    <View style={styles.myCard}>
      <AppText variant="caption" color="darkgreen">
        나의 여행 성향
      </AppText>
      <View style={styles.myTop}>
        <View style={styles.myNames}>
          <AppText variant="small13Bold" color="blue">
            {type}
          </AppText>
          <AppText variant="cardTitle" color="darkgreen" style={styles.name}>
            {profile.name}
          </AppText>
        </View>
        <View style={styles.myImageBox}>
          <Image source={MBTI_IMAGES[type]} style={styles.myImage} contentFit="contain" accessibilityLabel={`${type} ${profile.name} 캐릭터`} />
        </View>
      </View>
      <AppText variant="body" color="darkgreen">
        {profile.oneLiner}
      </AppText>
      <View style={styles.tags}>
        {profile.hashtags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <AppText variant="caption" color="blue">{`#${tag}`}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.myActions}>
        <Button label="성향 자세히 보기" height={48} labelColor="white" onPress={() => router.push("/my/persona")} />
        <Button label="성향 다시 검사하기" height={48} variant="secondary" labelColor="blue" style={styles.paleButton} onPress={() => router.push("/survey")} />
      </View>
    </View>
  );
}

function NoPersona({ variant }: { variant: Variant }) {
  return (
    <View style={variant === "home" ? styles.homeCard : styles.myCard}>
      <AppText variant="small12" color={variant === "home" ? "muted" : "darkgreen"}>
        나의 여행 성향
      </AppText>
      <AppText variant="label">나는 어떤 여행자일까요?</AppText>
      <AppText variant="small13" color="muted">
        취향 설문을 하면 여행 성향을 알려 드리고, 지역 추천에도 반영해요.
      </AppText>
      <Button label="성향검사 하기" variant="secondary" height={44} onPress={() => router.push("/survey")} style={styles.noPersonaButton} />
    </View>
  );
}

function PersonaSkeleton({ variant }: { variant: Variant }) {
  return (
    <View style={[variant === "home" ? styles.homeCard : styles.myCard, styles.skeleton]}>
      <Skeleton width="30%" height={12} />
      <Skeleton width="55%" height={22} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  homeCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: space[16], gap: space[8] },
  homeTop: { flexDirection: "row", alignItems: "center" },
  homeTexts: { flex: 1, gap: 2 },
  code: { marginTop: space[4] },
  name: { fontSize: 22, lineHeight: 31 },
  homeImage: { width: 104, height: 112 },
  homeActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space[4] },
  link: { minHeight: 44, justifyContent: "center", paddingRight: space[12] },
  retake: { flex: 1, maxWidth: 170 },
  myCard: { borderRadius: 20, backgroundColor: colors.mint, padding: space[16], gap: space[12] },
  myTop: { flexDirection: "row", alignItems: "center", gap: space[12] },
  myNames: { flex: 1, gap: 2 },
  myImageBox: { width: 140, height: 140, borderRadius: radius.lg, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  myImage: { width: 128, height: 128 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  tag: { paddingHorizontal: space[12], paddingVertical: space[4], borderRadius: radius.sm, backgroundColor: colors.white },
  myActions: { gap: space[12], marginTop: space[4] },
  paleButton: { backgroundColor: colors.paleblue },
  noPersonaButton: { marginTop: space[8] },
  skeleton: { gap: space[12] },
});
