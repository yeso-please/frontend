import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { AppText, PressableScale } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { LINK_STATE_LABEL, linkPeriod, linkState, type SentLinkLike, sortLinks } from "./linkState";

/** 지난(만료·취소) 링크는 접어 두고 이만큼만 먼저 보여 줍니다 */
const INACTIVE_PREVIEW = 0;

type Props<T extends SentLinkLike> = {
  links: T[];
  /** 링크마다 덧붙일 한 줄 (예: "2명이 친구가 됐어요", "민지님이 만듦") */
  detail?: (link: T) => string | null;
  /** 취소 확인 창에 보일 설명 */
  revokeMessage: string;
  onRevoke: (link: T) => void;
  revokingId: number | null;
};

/**
 * 보낸 링크 목록 — 사용 중인 링크는 취소할 수 있고, 만료·취소된 링크는 "지난 링크"로 접어 둡니다.
 * 친구 초대(2-5·2-6), 여행 초대(4-2·4-3), 코스 공유(4-10·4-11), 여행기 공유(6-9·6-10)가 함께 씁니다.
 */
export function SentLinkList<T extends SentLinkLike>({ links, detail, revokeMessage, onRevoke, revokingId }: Props<T>) {
  const [showInactive, setShowInactive] = useState(false);
  // 화면을 연 시각 기준으로 만료를 가립니다 (그리는 중에 시계를 읽지 않게)
  const [now] = useState(Date.now);
  const sorted = sortLinks(links, now);
  const active = sorted.filter((l) => linkState(l, now) === "ACTIVE");
  const inactive = sorted.filter((l) => linkState(l, now) !== "ACTIVE");
  const shown = [...active, ...(showInactive ? inactive : inactive.slice(0, INACTIVE_PREVIEW))];

  const confirm = (link: T) =>
    Alert.alert("이 링크를 취소할까요?", revokeMessage, [
      { text: "닫기", style: "cancel" },
      { text: "링크 취소", style: "destructive", onPress: () => onRevoke(link) },
    ]);

  return (
    <View style={styles.list}>
      {active.length === 0 ? (
        <AppText variant="small12" color="muted">
          사용 중인 링크가 없어요.
        </AppText>
      ) : null}
      {shown.map((link) => {
        const state = linkState(link, now);
        const extra = detail?.(link);
        return (
          <Animated.View key={link.id} entering={FadeIn.duration(160)} layout={LinearTransition} style={[styles.row, state !== "ACTIVE" && styles.rowInactive]}>
            <View style={styles.texts} accessible accessibilityLabel={`${LINK_STATE_LABEL[state]} 링크, ${linkPeriod(link, now)}${extra ? `, ${extra}` : ""}`}>
              <View style={styles.head}>
                <View style={[styles.chip, state === "ACTIVE" ? styles.chipActive : styles.chipInactive]}>
                  <AppText variant="badge" color={state === "ACTIVE" ? "darkgreen" : "muted"}>
                    {LINK_STATE_LABEL[state]}
                  </AppText>
                </View>
                <AppText variant="small12" color="muted">
                  {linkPeriod(link, now)}
                </AppText>
              </View>
              {extra ? (
                <AppText variant="small12" color="muted">
                  {extra}
                </AppText>
              ) : null}
            </View>
            {state === "ACTIVE" ? (
              revokingId === link.id ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <PressableScale onPress={() => confirm(link)} haptic="tick" hitSlop={8} style={styles.revoke} accessibilityRole="button" accessibilityLabel="링크 취소">
                  <AppText variant="small13Bold" color="danger">
                    취소
                  </AppText>
                </PressableScale>
              )
            ) : null}
          </Animated.View>
        );
      })}
      {inactive.length > INACTIVE_PREVIEW ? (
        <PressableScale onPress={() => setShowInactive((v) => !v)} haptic={false} hitSlop={6} style={styles.toggle} accessibilityRole="button">
          <AppText variant="small12" color="muted">
            {showInactive ? "지난 링크 접기" : `지난 링크 ${inactive.length}개 보기`}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[8] },
  row: { flexDirection: "row", alignItems: "center", gap: space[12], paddingHorizontal: space[12], paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  rowInactive: { backgroundColor: colors.surface },
  texts: { flex: 1, gap: 2 },
  head: { flexDirection: "row", alignItems: "center", gap: space[8] },
  chip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  chipActive: { backgroundColor: colors.mint },
  chipInactive: { backgroundColor: colors.border },
  revoke: { paddingHorizontal: space[8], paddingVertical: space[4] },
  toggle: { alignSelf: "flex-start", paddingVertical: space[4] },
});
