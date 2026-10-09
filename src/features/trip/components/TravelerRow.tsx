import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { motion, sizes, space } from "@/theme";

import { Avatar } from "./Avatar";

export type TravelerRowModel =
  | { key: string; userId: number; nickname: string; kind: "joined"; isMe: boolean }
  | { key: string; userId: number; nickname: string; kind: "pending"; inviteId: number };

type Props = {
  row: TravelerRowModel;
  index: number;
  onCancel?: (row: Extract<TravelerRowModel, { kind: "pending" }>) => void;
  cancelling?: boolean;
};

/**
 * 피그마 TriPin/Invitation/Friend Row — 함께하는 중(설문 완료 + 체크) / 응답 대기 중(blue).
 * 같은 친구는 같은 key(userId)를 써서, 대기 → 함께하는 중으로 바뀌면 자리 이동(LinearTransition)과 상태 교차로 보여줍니다.
 */
export function TravelerRow({ row, index, onCancel, cancelling }: Props) {
  const joined = row.kind === "joined";
  const name = joined && row.isMe ? `${row.nickname} · 나` : row.nickname;
  // 참여자는 모두 온보딩(취향 설문)을 마친 회원입니다 (서버 규칙).
  const status = joined ? "취향 설문 완료" : "응답 대기 중";

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(motion.spring.gentle.damping)}
      entering={FadeInDown.delay(index * 40).springify()}
      exiting={FadeOut.duration(180)}
      style={styles.row}
      accessible={joined}
      accessibilityLabel={`${name}, ${status}`}
    >
      <Animated.View key={row.kind} entering={FadeIn.duration(260)}>
        <Avatar name={row.nickname} tone={joined ? "mint" : "paleblue"} />
      </Animated.View>

      <View style={styles.texts}>
        <AppText variant="bold14" numberOfLines={1}>
          {name}
        </AppText>
        <Animated.View key={status} entering={FadeIn.duration(260)}>
          <AppText variant="small12" color={joined ? "darkgreen" : "blue"}>
            {status}
          </AppText>
        </Animated.View>
      </View>

      {row.kind === "joined" ? (
        <Animated.View entering={FadeIn.duration(260)}>
          <Icons.CheckFriend width={20} height={20} />
        </Animated.View>
      ) : (
        <PressableScale
          onPress={() => onCancel?.(row)}
          disabled={cancelling || !onCancel}
          haptic="tap"
          style={styles.cancel}
          accessibilityRole="button"
          accessibilityLabel={`${row.nickname}님 초대 취소`}
          accessibilityState={{ disabled: !!cancelling, busy: !!cancelling }}
        >
          <AppText variant="small12" color="muted">
            {cancelling ? "취소 중" : "초대 취소"}
          </AppText>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[12] },
  texts: { flex: 1 },
  cancel: { minWidth: sizes.touchTarget, height: sizes.touchTarget, paddingHorizontal: space[8], alignItems: "center", justifyContent: "center", marginRight: -space[8] },
});
