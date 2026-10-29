import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { useSheetBackHandler } from "@/lib/useSheetBackHandler";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

import { MAX_PHOTOS } from "../constants";

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;

type Props = {
  /** 앞으로 더 올릴 수 있는 장수 */
  remaining: number;
  onCamera: () => void;
  onAlbum: () => void;
  onClose: () => void;
};

/**
 * 추가 화면 05 · 사진 첨부 — 카메라 / 앨범에서 선택.
 * 디자인의 "최근 항목" 격자는 사진 보관함 모듈(expo-media-library)이 있어야 해서, 앨범은 시스템 사진 선택기를 엽니다.
 */
export const PhotoSheet = forwardRef<BottomSheetModal, Props>(function PhotoSheet({ remaining, onCamera, onAlbum, onClose }, ref) {
  const insets = useSafeAreaInsets();
  const back = useSheetBackHandler(ref);
  return (
    <BottomSheetModal ref={ref} onChange={back.onChange} enableDynamicSizing backdropComponent={renderBackdrop} handleIndicatorStyle={styles.handle} backgroundStyle={styles.sheet}>
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + space[24] }]}>
        <View style={styles.head}>
          <View style={styles.flex}>
            <AppText variant="cardTitle">사진 첨부</AppText>
            <AppText variant="small12" color="muted">
              {`최대 ${MAX_PHOTOS}장까지 고를 수 있어요 · ${remaining}장 남았어요`}
            </AppText>
          </View>
          <PressableScale onPress={onClose} haptic={false} hitSlop={12} accessibilityRole="button" accessibilityLabel="닫기">
            <Icons.Close20 width={20} height={20} />
          </PressableScale>
        </View>
        <View style={styles.actions}>
          <Action label="카메라" icon={<Icons.Camera width={20} height={20} />} onPress={onCamera} />
          <Action label="앨범에서 선택" icon={<Icons.Album width={20} height={20} />} onPress={onAlbum} />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function Action({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.actionIcon}>{icon}</View>
      <AppText variant="small13Bold">{label}</AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  handle: { width: 38, height: 4, backgroundColor: "#D7DDD9" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], gap: space[16] },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space[12] },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1, height: 88, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 7 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
