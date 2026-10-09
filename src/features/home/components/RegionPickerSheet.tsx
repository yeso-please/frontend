import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { type Ref, useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icons } from "@/components/icons";
import { AppText, ErrorView, LoadingView, PressableScale } from "@/components/ui";
import { colors, radius, screenPadding, sizes, space, typography } from "@/theme";

import { type MapRegion, normalizeQuery } from "../lib/regions";
import { SheetHandle } from "./DestinationSheet";

type Props = {
  ref?: Ref<BottomSheetModal>;
  regions: MapRegion[];
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  onSelect: (region: MapRegion) => void;
  onDismiss: () => void;
};

const SNAP_POINTS = ["88%"];

/** "직접 지역 선택하기" — 피그마 디자인이 없어 홈 토큰으로 만든 검색 + 목록 시트 */
export function RegionPickerSheet({ ref, regions, isPending, error, onRetry, onSelect, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return regions;
    return regions.filter((r) => normalizeQuery(`${r.province}${r.city}${r.name}`).includes(q));
  }, [regions, query]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} pressBehavior="close" />,
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      handleComponent={SheetHandle}
      backgroundStyle={styles.background}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={() => {
        setQuery("");
        onDismiss();
      }}
    >
      <View style={styles.head}>
        <AppText variant="cardTitle" accessibilityRole="header">
          어디로 떠나볼까요?
        </AppText>
        <AppText variant="body" color="muted">
          {isPending ? "지역을 불러오는 중이에요" : `핀을 꽂을 수 있는 지역 ${regions.length}곳`}
        </AppText>
        <View style={styles.search}>
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="지역 이름으로 찾기 (예: 강릉, 해운대)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="지역 검색"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} style={styles.clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="검색어 지우기">
              <Icons.Close width={18} height={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isPending ? (
        <LoadingView label="지역을 불러오는 중이에요" />
      ) : error ? (
        <ErrorView error={error} onRetry={onRetry} />
      ) : (
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(r: MapRegion) => r.sigCd}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + space[24] }}
          renderItem={({ item, index }: { item: MapRegion; index: number }) => (
            <PressableScale
              onPress={() => onSelect(item)}
              haptic="tick"
              scaleTo={0.98}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`${item.province} ${item.city}`}
              accessibilityHint="이 지역에 핀을 꽂아요"
            >
              {index % 2 === 0 ? <Icons.PinBlue20 width={20} height={20} /> : <Icons.PinDarkgreen20 width={20} height={20} />}
              <View style={styles.rowText}>
                <AppText variant="label" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="small13" color="muted" numberOfLines={1}>
                  {item.province} {item.city}
                </AppText>
              </View>
              <Icons.ChevronRight width={16} height={16} />
            </PressableScale>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppText variant="label" align="center">
                {regions.length === 0 ? "지금은 뽑을 수 있는 지역이 없어요" : "찾는 지역이 없어요"}
              </AppText>
              {regions.length > 0 ? (
                <AppText variant="body" color="muted" align="center">
                  시·군·구 이름으로 다시 찾아보세요.
                </AppText>
              ) : null}
            </View>
          }
        />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  head: { paddingHorizontal: screenPadding, paddingTop: space[8], paddingBottom: space[12], gap: space[4] },
  search: { marginTop: space[12], justifyContent: "center" },
  input: {
    ...typography.body,
    height: 48,
    paddingHorizontal: space[16],
    paddingRight: 44,
    paddingVertical: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clear: { position: "absolute", right: 0, width: sizes.touchTarget, height: sizes.touchTarget, alignItems: "center", justifyContent: "center" },
  row: {
    minHeight: 60,
    paddingHorizontal: screenPadding,
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  empty: { paddingTop: space[32], paddingHorizontal: screenPadding, gap: space[8] },
});
