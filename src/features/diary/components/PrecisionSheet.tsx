import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { LocationPrecision } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, PressableScale } from "@/components/ui";
import { colors, radius, screenPadding, shadows, space } from "@/theme";

import { PRECISION_OPTIONS } from "../constants";

const renderBackdrop = (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />;

type Props = { value: LocationPrecision; onSelect: (value: LocationPrecision) => void };

/** 추가 화면 04 "사진 위치 공개 ›" — 세 가지 중 하나를 고르는 시트 (안드로이드 Alert는 버튼이 3개까지라 시트로 둡니다) */
export const PrecisionSheet = forwardRef<BottomSheetModal, Props>(function PrecisionSheet({ value, onSelect }, ref) {
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModal ref={ref} enableDynamicSizing backdropComponent={renderBackdrop} handleIndicatorStyle={styles.handle} backgroundStyle={styles.sheet}>
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + space[24] }]}>
        <View style={styles.head}>
          <AppText variant="cardTitle">사진 위치 공개</AppText>
          <AppText variant="small12" color="muted">
            다른 사람에게 사진 위치를 어떻게 보여 줄까요? 나에게는 항상 찍은 위치 그대로 보여요.
          </AppText>
        </View>
        {PRECISION_OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => onSelect(o.value)}
              haptic="tick"
              scaleTo={0.98}
              style={[styles.option, on && styles.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${o.rowLabel}, ${o.hint}`}
            >
              <View style={styles.flex}>
                <AppText variant="bold14" color={on ? "darkgreen" : "charcoal"}>
                  {o.rowLabel}
                </AppText>
                <AppText variant="small12" color="muted">
                  {o.hint}
                </AppText>
              </View>
              {on ? <Icons.CheckFriend width={20} height={20} /> : null}
            </PressableScale>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  handle: { width: 38, height: 4, backgroundColor: "#D7DDD9" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadows.sheet },
  content: { paddingHorizontal: screenPadding, paddingTop: space[16], gap: 10 },
  head: { gap: space[4], marginBottom: space[8] },
  option: { flexDirection: "row", alignItems: "center", gap: space[12], padding: space[16], borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: "#A7DFC1", backgroundColor: colors.mint },
});
