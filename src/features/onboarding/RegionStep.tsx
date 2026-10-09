import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";

import { regionApi } from "@/api/endpoints";
import { queryKeys } from "@/api/queryKeys";
import type { Region } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, EmptyView, ErrorView, LoadingView, PressableScale } from "@/components/ui";
import { haptics } from "@/lib/haptics";
import { shortRegionName } from "@/lib/josa";
import { colors, fonts, motion, radius, screenPadding, sizes, space } from "@/theme";

import { StepHeading } from "./StepHeading";

type Props = {
  max: number;
  selected: Region[];
  onChange: (regions: Region[]) => void;
};

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** 3단계 — 좋아했던 여행지 (선택, 최대 max곳). 피그마 화면이 없어 온보딩 카드 톤에 맞춘 검색 목록입니다. */
export function RegionStep({ max, selected, onChange }: Props) {
  const regionsQuery = useQuery({ queryKey: queryKeys.regions(), queryFn: () => regionApi.list() });
  const [text, setText] = useState("");
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    if (!limitHit) return;
    const timer = setTimeout(() => setLimitHit(false), 2200);
    return () => clearTimeout(timer);
  }, [limitHit]);

  // 검색은 "강릉", "강원 강릉", "해운대" 모두 걸리도록 시도·시군구·짧은 이름을 붙여 비교합니다.
  const indexed = useMemo(
    () =>
      (regionsQuery.data?.regions ?? []).map((r) => {
        const name = shortRegionName(r.province, r.city);
        return { region: r, name, key: normalize(`${r.province}${r.city}${name}`) };
      }),
    [regionsQuery.data],
  );
  const results = useMemo(() => {
    const q = normalize(text);
    return q ? indexed.filter((item) => item.key.includes(q)) : indexed;
  }, [indexed, text]);

  const selectedIds = new Set(selected.map((r) => r.sigCd));

  const toggle = (region: Region) => {
    if (selectedIds.has(region.sigCd)) {
      haptics.tick();
      onChange(selected.filter((r) => r.sigCd !== region.sigCd));
      return;
    }
    if (selected.length >= max) {
      haptics.reject();
      setLimitHit(true);
      return;
    }
    haptics.tick();
    onChange([...selected, region]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <StepHeading title="좋아했던 여행지가 있나요?" subtitle={`다시 가고 싶은 곳을 최대 ${max}곳까지 골라주세요. 없으면 건너뛰어도 괜찮아요.`} />

        <View style={styles.search}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="지역 이름으로 찾기 (예: 강릉, 해운대)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="지역 검색"
          />
          {text ? (
            <PressableScale onPress={() => setText("")} haptic={false} style={styles.clear} accessibilityRole="button" accessibilityLabel="검색어 지우기">
              <Icons.Close width={18} height={18} />
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.chipsRow}>
          {selected.length === 0 ? (
            <Animated.View entering={FadeIn} exiting={FadeOut.duration(120)}>
              <AppText variant="small13" color="muted">
                선택한 여행지가 여기에 모여요.
              </AppText>
            </Animated.View>
          ) : (
            selected.map((r) => (
              <Animated.View key={r.sigCd} entering={ZoomIn.springify().damping(motion.spring.snappy.damping)} exiting={ZoomOut.duration(140)} layout={LinearTransition.springify()}>
                <PressableScale
                  onPress={() => toggle(r)}
                  haptic={false}
                  scaleTo={0.94}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortRegionName(r.province, r.city)} 선택 해제`}
                >
                  <AppText variant="small13Medium" color="darkgreen">
                    {shortRegionName(r.province, r.city)}
                  </AppText>
                  <Icons.Close width={14} height={14} />
                </PressableScale>
              </Animated.View>
            ))
          )}
          {limitHit ? (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(200)} style={styles.limit}>
              <AppText variant="caption" color="onboardingAccent" accessibilityLiveRegion="assertive">
                {`최대 ${max}곳까지 고를 수 있어요.`}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={styles.listWrap}>
        {regionsQuery.isPending ? (
          <LoadingView label="여행지를 불러오는 중이에요" />
        ) : regionsQuery.isError ? (
          <ErrorView error={regionsQuery.error} onRetry={() => regionsQuery.refetch()} />
        ) : (
          <FlashList
            data={results}
            keyExtractor={(item) => item.region.sigCd}
            extraData={selected}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <EmptyView title="찾는 지역이 없어요" description="다른 이름으로 검색해 보세요." />
              </View>
            }
            renderItem={({ item }) => <RegionRow name={item.name} region={item.region} selected={selectedIds.has(item.region.sigCd)} onPress={() => toggle(item.region)} />}
          />
        )}
      </View>
    </View>
  );
}

function RegionRow({ name, region, selected, onPress }: { name: string; region: Region; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={0.98}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${region.province} ${region.city}`}
    >
      <View style={styles.rowTexts}>
        <AppText variant="label" color={selected ? "darkgreen" : "charcoal"} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="small12" color="muted" numberOfLines={1}>
          {`${region.province} ${region.city}`}
        </AppText>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>{selected ? <Icons.CheckFriend width={18} height={18} /> : null}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: screenPadding, paddingTop: space[32] + 8, gap: space[16] },
  search: { justifyContent: "center" },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.onboardingCardBorder,
    paddingLeft: space[16],
    paddingRight: sizes.touchTarget + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },
  clear: {
    position: "absolute",
    right: 2,
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: { minHeight: 36, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[8] },
  chip: {
    height: 36,
    paddingLeft: space[12],
    paddingRight: space[8] + 2,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  limit: { marginLeft: space[4] },
  listWrap: { flex: 1, marginTop: space[8] },
  listContent: { paddingHorizontal: screenPadding, paddingBottom: space[24] },
  empty: { paddingTop: space[32] },
  row: {
    minHeight: 60,
    marginTop: space[8],
    paddingHorizontal: space[16],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
  },
  rowSelected: { backgroundColor: colors.mint, borderColor: colors.green },
  rowTexts: { flex: 1 },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkOn: { borderColor: colors.green, backgroundColor: colors.white },
});
