import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { motion, sizes, space } from "@/theme";

import { Avatar } from "./Avatar";

export type TravelerRowModel =
  /** 참여자 — tag는 이름 뒤에 붙는 "나"·"초대자", status는 "취향 설문 완료" 같은 상태 줄 */
  | { key: string; userId: number; nickname: string; kind: "joined"; tag?: string; status: string }
  /** 친구 초대를 보냈고 아직 응답이 없는 사람 (D10: 친구 초대로 보낸 사람만 대기 표시) */
  | { key: string; userId: number; nickname: string; kind: "pending"; inviteId: number; status: string };

type Props = {
  row: TravelerRowModel;
  index: number;
  onCancel?: (row: Extract<TravelerRowModel, { kind: "pending" }>) => void;
  cancelling?: boolean;
};

/**
 * 피그마 D1·D2c "함께하는 여행자" 행 — 참여(초록 상태 + 체크) / 응답 대기(파란 상태).
 * 같은 친구는 같은 key(userId)를 써서, 대기 → 참여로 바뀌면 자리 이동(LinearTransition)과 상태 교차로 보여 줍니다.
 */
export function TravelerRow({ row, index, onCancel, cancelling }: Props) {
  const joined = row.kind === "joined";
  const name = joined && row.tag ? `${row.nickname} · ${row.tag}` : row.nickname;

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(motion.spring.gentle.damping)}
      entering={FadeInDown.delay(index * 40).springify()}
      exiting={FadeOut.duration(180)}
      style={styles.row}
      accessible={joined}
      accessibilityLabel={`${name}, ${row.status}`}
    >
      <Animated.View key={row.kind} entering={FadeIn.duration(260)}>
        <Avatar name={row.nickname} tone={joined ? "mint" : "paleblue"} />
      </Animated.View>

      <View style={styles.texts}>
        <AppText variant="bold14" numberOfLines={1}>
          {name}
        </AppText>
        <Animated.View key={row.status} entering={FadeIn.duration(260)}>
          <AppText variant="small12" color={joined ? "darkgreen" : "blue"}>
            {row.status}
          </AppText>
        </Animated.View>
      </View>

      {row.kind === "joined" ? (
        <Animated.View entering={FadeIn.duration(260)}>
          <Icons.CheckFriend width={20} height={20} />
        </Animated.View>
      ) : onCancel ? (
        <PressableScale
          onPress={() => onCancel(row)}
          disabled={cancelling}
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
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[12] },
  texts: { flex: 1, gap: 2 },
  cancel: { minWidth: sizes.touchTarget, height: sizes.touchTarget, paddingHorizontal: space[8], alignItems: "center", justifyContent: "center", marginRight: -space[8] },
});
