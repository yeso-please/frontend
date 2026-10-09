import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, radius, space } from "@/theme";

import { Skeleton } from "./Skeleton";

type Props = {
  /** 발급된 초대 링크 (발급 중이면 null) */
  link: string | null;
  status: "loading" | "ready" | "error";
  onCopy: () => void;
  onShare: () => void;
  onRetry: () => void;
};

/** 피그마 TriPin/Invitation/Invite Card — 링크 복사(outline) / 초대 링크 공유(mint) */
export function InviteCard({ link, status, onCopy, onShare, onRetry }: Props) {
  const ready = status === "ready" && !!link;
  return (
    <View style={styles.card}>
      <AppText variant="label">같이 떠나면 더 즐거우니까</AppText>

      <View style={styles.linkSlot}>
        {status === "loading" ? <Skeleton width="62%" height={14} /> : null}
        {ready ? (
          <Animated.View entering={FadeIn.duration(220)}>
            <AppText variant="small12" color="muted" numberOfLines={1} ellipsizeMode="middle" selectable accessibilityLabel="초대 링크">
              {link}
            </AppText>
          </Animated.View>
        ) : null}
        {status === "error" ? (
          <View style={styles.errorRow}>
            <AppText variant="small12" color="muted">
              링크를 만들지 못했어요.
            </AppText>
            <PressableScale onPress={onRetry} accessibilityRole="button" hitSlop={{ top: 14, bottom: 14 }}>
              <AppText variant="small13Bold" color="blue">
                다시 만들기
              </AppText>
            </PressableScale>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PressableScale
          onPress={onCopy}
          disabled={!ready}
          style={[styles.button, styles.copy, !ready && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="초대 링크 복사"
          accessibilityState={{ disabled: !ready }}
        >
          <Icons.Copy width={18} height={18} />
          <AppText variant="small13Bold">링크 복사</AppText>
        </PressableScale>
        <PressableScale
          onPress={onShare}
          disabled={!ready}
          style={[styles.button, styles.share, !ready && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="초대 링크 공유"
          accessibilityState={{ disabled: !ready }}
        >
          <Icons.Share width={18} height={18} />
          <AppText variant="small13Bold" color="darkgreen">
            초대 링크 공유
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[16], gap: space[8], borderRadius: radius.lg, backgroundColor: colors.surface },
  linkSlot: { minHeight: 20, justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  actions: { flexDirection: "row", gap: space[8], marginTop: space[4] },
  button: { height: 48, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[8] },
  // 피그마 130 : 172 비율
  copy: { flex: 130, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  share: { flex: 172, backgroundColor: colors.mint },
  disabled: { opacity: 0.5 },
});
