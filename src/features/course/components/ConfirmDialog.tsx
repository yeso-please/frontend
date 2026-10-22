import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { AppText, Button } from "@/components/ui";
import { colors, motion, radius, screenPadding, space } from "@/theme";

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** 위험한 동작(내보내기·나가기·다시 만들기)이면 확인 버튼을 회색 바탕 + 빨간 글자로 */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 피그마 E3 숨김 레이어 "Participant confirmation" — 어두운 배경 위 카드, 보조 버튼 + 주 버튼 */
export function ConfirmDialog({ visible, title, body, confirmLabel, cancelLabel = "취소", destructive, loading, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onCancel} accessibilityLabel="닫기">
          <View style={styles.dimmer} />
        </Pressable>
        <Animated.View
          entering={ZoomIn.springify().damping(motion.spring.gentle.damping).stiffness(260)}
          style={styles.card}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <AppText variant="taskTitle">{title}</AppText>
          {body ? (
            <AppText variant="body" color="muted">
              {body}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" height={48} onPress={onCancel} disabled={loading} />
            <Button
              label={confirmLabel}
              variant={destructive ? "neutral" : "primary"}
              onPress={onConfirm}
              loading={loading}
              labelColor={destructive ? "danger" : undefined}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: screenPadding },
  dimmer: { flex: 1, backgroundColor: colors.scrim },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: space[16], gap: space[12] },
  actions: { gap: space[8], marginTop: space[4] },
});
