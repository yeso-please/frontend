import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInRight, LinearTransition } from "react-native-reanimated";
import { toast } from "sonner-native";

import { diaryApi, type UploadFile } from "@/api/endpoints";
import { errorMessage, isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import type { Diary } from "@/api/types";
import { Icons } from "@/components/icons";
import { AppText, BottomCTA, Button, ErrorView, LoadingView, PressableScale, Screen, TopBar } from "@/components/ui";
import { SegmentedTabs } from "@/features/course/components/SegmentedTabs";
import { useRegionLabel } from "@/features/trip/hooks/useRegionLabel";
import { diffDays, formatNights } from "@/lib/date";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, screenPadding, space } from "@/theme";

import { PhotoSheet } from "../components/PhotoSheet";
import { PinPreview } from "../components/PinPreview";
import { PrecisionSheet } from "../components/PrecisionSheet";
import { StarRatingInput } from "../components/StarRating";
import {
  BODY_MAX,
  EXIF_NOTE,
  EXPERIENCE_TAGS,
  MAX_EXPERIENCE_TAGS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PRECISION_OPTIONS,
  SATISFACTION_LABELS,
  TITLE_MAX,
  VISIBILITY_OPTIONS,
} from "../constants";
import { useDiary, useInvalidateDiaries, useMyTravelMap } from "../hooks";
import { diffForm, type Form, formOf } from "../lib";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const GRID_GAP = 5;

type Step = "write" | "settings";

/**
 * 여행기 쓰기·수정 (6-2·6-3·6-4·6-5) — 피그마 추가 화면 02·03(쓰기) → 04(설정) → 05(사진 첨부 시트).
 * 디자인의 "장소별 기록"은 백엔드에 없어 여행 전체 단위로 씁니다 (backend-requests 메모).
 */
export function DiaryEditScreen({ diaryId }: { diaryId: number }) {
  const diary = useDiary(diaryId);
  const map = useMyTravelMap();
  if (diary.isPending || map.isPending) {
    return (
      <Screen>
        <TopBar title="여행기 쓰기" />
        <LoadingView />
      </Screen>
    );
  }
  if (diary.isError) {
    return (
      <Screen>
        <TopBar title="여행기 쓰기" />
        <ErrorView error={diary.error} onRetry={() => void diary.refetch()} />
      </Screen>
    );
  }
  // 6-6은 작성자에게 locationPrecision을 늘 EXACT(작성자에게 보이는 정밀도)로 돌려줘서, 저장된 설정은 지도 핀(6-7)에서 읽습니다
  // (_local/backend-requests.md 7번). 핀을 못 읽으면 6-6 값을 씁니다.
  const pin = map.data?.find((p) => p.diaryId === diaryId);
  return <DiaryEditor diary={pin ? { ...diary.data, locationPrecision: pin.locationPrecision } : diary.data} />;
}

function DiaryEditor({ diary }: { diary: Diary }) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDiaries();
  const sheetRef = useRef<BottomSheetModal>(null);
  const precisionRef = useRef<BottomSheetModal>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [step, setStep] = useState<Step>("write");
  const [saved, setSaved] = useState<Form>(() => formOf(diary));
  const [form, setForm] = useState<Form>(() => formOf(diary));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const key = queryKeys.diary(diary.diaryId);
  const draft = diary.status === "DRAFT";
  const titleValid = form.title.trim().length >= 1 && form.title.trim().length <= TITLE_MAX;
  const region = useRegionLabel(diary.regionSigCd);
  const eyebrow = [region, formatNights(diffDays(diary.visitedFrom, diary.visitedTo))].filter(Boolean).join(" · ");

  const applyDiary = (next: Diary) => {
    queryClient.setQueryData(key, next);
    invalidate();
  };

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean; leave: boolean }) => {
      const patch = diffForm(saved, form);
      let next = Object.keys(patch).length > 0 ? await diaryApi.update(diary.diaryId, patch) : diary;
      if (publish) next = await diaryApi.publish(diary.diaryId);
      return next;
    },
    onSuccess: (next, { publish, leave }) => {
      haptics.confirm();
      applyDiary(next);
      setSaved(formOf(next));
      setForm(formOf(next));
      toast(publish ? "여행기를 발행했어요" : "저장했어요");
      // 설정의 "완료"는 보기 화면으로 갑니다 (쌓인 보기 화면이 있으면 그리로 돌아가고, 없으면 바꿔 엽니다). 임시저장은 계속 씁니다.
      if (leave) router.dismissTo({ pathname: "/diary/[diaryId]", params: { diaryId: String(diary.diaryId) } });
    },
    onError: (e) => {
      haptics.reject();
      toast(isApiError(e, "DIARY_NOT_PUBLISHABLE") ? "제목을 입력해야 발행할 수 있어요" : errorMessage(e));
    },
  });

  const upload = useMutation({
    mutationFn: (files: UploadFile[]) => diaryApi.uploadPhotos(diary.diaryId, files),
    onSuccess: async () => {
      haptics.confirm();
      await queryClient.invalidateQueries({ queryKey: key });
      invalidate();
    },
    onError: (e) => {
      haptics.reject();
      if (isApiError(e, "DIARY_PHOTO_LIMIT_EXCEEDED")) toast(`사진은 여행기마다 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
      else if (isApiError(e, "DIARY_PHOTO_INVALID")) toast("올릴 수 없는 사진이 있어요. JPEG·PNG·WebP, 10MB 이하만 돼요");
      else if (isApiError(e, "DIARY_PHOTO_STORAGE_UNAVAILABLE")) toast("지금은 사진을 올릴 수 없어요. 잠시 후 다시 시도해 주세요");
      else toast(errorMessage(e));
    },
  });

  const photoAction = useMutation({
    mutationFn: async ({ kind, photoId }: { kind: "cover" | "delete"; photoId: number }) => {
      if (kind === "cover") return diaryApi.update(diary.diaryId, { coverPhotoId: photoId });
      await diaryApi.deletePhoto(diary.diaryId, photoId);
      return diaryApi.get(diary.diaryId);
    },
    onSuccess: (next) => {
      haptics.tick();
      applyDiary(next);
    },
    onError: (e) => toast(errorMessage(e)),
  });

  const remaining = MAX_PHOTOS - diary.photos.length;
  const uploadAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const picked = assets.slice(0, remaining);
    const files: UploadFile[] = picked
      .filter((a) => (a.fileSize ?? 0) <= MAX_PHOTO_BYTES && ALLOWED.has(a.mimeType ?? "image/jpeg"))
      .map((a, i) => ({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}-${i}.jpg`, type: a.mimeType ?? "image/jpeg" }));
    if (files.length < picked.length) toast(`${picked.length - files.length}장은 형식이나 크기(10MB) 때문에 뺐어요`);
    if (files.length > 0) upload.mutate(files);
  };
  const openPhotoSheet = () => {
    if (remaining <= 0) {
      toast(`사진은 ${MAX_PHOTOS}장까지예요`);
      return;
    }
    sheetRef.current?.present();
  };
  const pickFromAlbum = async () => {
    sheetRef.current?.dismiss();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1, // 다시 압축하지 않아야 촬영 시각·위치(EXIF)가 남아 지도 핀이 정확해집니다
      exif: false,
    });
    if (!result.canceled) uploadAssets(result.assets);
  };
  const takePhoto = async () => {
    sheetRef.current?.dismiss();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast("카메라 권한이 있어야 사진을 찍을 수 있어요");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
    if (!result.canceled) uploadAssets(result.assets);
  };

  const onPhotoPress = (photoId: number) => {
    const isCover = diary.coverPhotoId === photoId;
    Alert.alert("사진", isCover ? "지금 대표 사진이에요." : "대표 사진으로 정하거나 지울 수 있어요.", [
      ...(isCover ? [] : [{ text: "대표 사진으로", onPress: () => photoAction.mutate({ kind: "cover", photoId }) }]),
      { text: "사진 지우기", style: "destructive" as const, onPress: () => photoAction.mutate({ kind: "delete", photoId }) },
      { text: "취소", style: "cancel" as const },
    ]);
  };

  const toggleTag = (tag: string) => {
    const has = form.experienceTags.includes(tag);
    if (!has && form.experienceTags.length >= MAX_EXPERIENCE_TAGS) {
      haptics.reject();
      toast(`경험 태그는 ${MAX_EXPERIENCE_TAGS}개까지 고를 수 있어요`);
      return;
    }
    haptics.tick();
    set("experienceTags", has ? form.experienceTags.filter((t) => t !== tag) : [...form.experienceTags, tag]);
  };


  // 설정 단계에서 하드웨어 뒤로 가기는 쓰기 단계로 돌아갑니다
  const backToWrite = () => setStep("write");
  useEffect(() => {
    if (step !== "settings") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep("write");
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const dirty = Object.keys(diffForm(saved, form)).length > 0;
  const visibilityHint = VISIBILITY_OPTIONS.find((o) => o.value === form.visibility)?.hint;
  const precision = PRECISION_OPTIONS.find((o) => o.value === form.locationPrecision);
  const tile = (screenWidth - screenPadding * 2 - GRID_GAP * 2) / 3;

  if (step === "settings") {
    return (
      <Screen>
        <TopBar title="설정" onBack={backToWrite} />
        <Animated.View entering={FadeInRight.duration(220)} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.settings}>
            <View style={styles.block}>
              <AppText variant="bold14">공개 범위</AppText>
              <SegmentedTabs options={VISIBILITY_OPTIONS.map(({ value, label }) => ({ value, label }))} value={form.visibility} onChange={(v) => set("visibility", v)} accessibilityLabel="공개 범위" />
              <View style={styles.hintRow}>
                <Icons.Lock15 width={15} height={15} />
                <AppText variant="small12" color="muted" style={styles.flex}>
                  {visibilityHint}
                </AppText>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.block}>
              <PressableScale onPress={() => precisionRef.current?.present()} scaleTo={0.98} style={styles.precisionRow} accessibilityRole="button" accessibilityLabel={`사진 위치 공개, ${precision?.rowLabel}`}>
                <View style={styles.flex}>
                  <AppText variant="bold14">사진 위치 공개</AppText>
                  <AppText variant="small12" color="darkgreen" style={styles.medium}>
                    {precision?.rowLabel}
                  </AppText>
                </View>
                <Icons.Chevron18 width={18} height={18} />
              </PressableScale>
              <View style={styles.note}>
                <AppText variant="small12" color="muted">{`${precision?.hint} ${EXIF_NOTE}`}</AppText>
              </View>
            </View>
            <View style={styles.tasteCard}>
              <View style={styles.flex}>
                <AppText variant="bold14">다음 추천에 반영</AppText>
                <AppText variant="small12" style={styles.tasteText}>
                  발행하면 별점·경험 태그·다녀온 지역을 다음 코스 추천에 조금 반영해요. 본문과 사진은 쓰지 않아요.
                </AppText>
              </View>
              <Switch
                value={form.includeInTasteProfile}
                onValueChange={(v) => set("includeInTasteProfile", v)}
                trackColor={{ true: colors.green, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel="다음 추천에 반영"
              />
            </View>
            <View style={styles.block}>
              <View style={styles.blockHead}>
                <AppText variant="bold14">대표 사진 핀</AppText>
                <AppText variant="badge" color="muted">
                  지도에서 다시 만나요
                </AppText>
              </View>
              <PinPreview title={form.title.trim() || diary.title} photos={diary.photos} coverPhotoId={diary.coverPhotoId} />
            </View>
          </ScrollView>
        </Animated.View>
        <BottomCTA>
          <Button
            label={draft ? "발행하기" : "완료"}
            disabled={!titleValid || (!draft && !dirty)}
            loading={save.isPending}
            onPress={() => save.mutate({ publish: draft, leave: true })}
          />
        </BottomCTA>
        <PrecisionSheet
          ref={precisionRef}
          value={form.locationPrecision}
          onSelect={(v) => {
            set("locationPrecision", v);
            precisionRef.current?.dismiss();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title={draft ? "여행기 쓰기" : "여행기 수정"}
        right={
          draft ? (
            <PressableScale onPress={() => save.mutate({ publish: false, leave: false })} disabled={!dirty || !titleValid || save.isPending} hitSlop={8} accessibilityRole="button" accessibilityLabel="임시저장">
              <AppText variant="small13Bold" color={dirty && titleValid ? "darkgreen" : "muted"}>
                임시저장
              </AppText>
            </PressableScale>
          ) : null
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {eyebrow ? (
              <AppText variant="badge" color="darkgreen" style={styles.bold}>
                {eyebrow}
              </AppText>
            ) : null}
            <TextInput
              value={form.title}
              onChangeText={(v) => set("title", v)}
              maxLength={TITLE_MAX}
              multiline
              submitBehavior="blurAndSubmit"
              placeholder="여행에 이름을 붙여 주세요"
              placeholderTextColor={colors.muted}
              style={styles.titleInput}
              accessibilityLabel="여행기 제목"
            />
            <View style={styles.rateRow}>
              <View style={styles.flex}>
                <AppText variant="small13" color="muted">
                  전체 여행은 어땠나요?
                </AppText>
                {form.satisfaction ? (
                  <AppText variant="small12" color="darkgreen" style={styles.medium}>
                    {SATISFACTION_LABELS[form.satisfaction - 1]}
                  </AppText>
                ) : null}
              </View>
              <StarRatingInput value={form.satisfaction} onChange={(v) => set("satisfaction", v)} />
            </View>
          </View>

          <View style={styles.body}>
            <SectionHead title="사진" right={<Counter value={diary.photos.length} max={MAX_PHOTOS} strong />} />
            <View style={styles.grid}>
              {diary.photos.map((photo, i) => {
                // 첫 사진은 두 칸 너비로 크게 (03 · 장소 기록)
                const wide = i === 0;
                return (
                  <Animated.View key={photo.photoId} entering={FadeIn.duration(200)} layout={LinearTransition}>
                    <PressableScale
                      onPress={() => onPhotoPress(photo.photoId)}
                      scaleTo={0.96}
                      accessibilityRole="button"
                      accessibilityLabel={diary.coverPhotoId === photo.photoId ? "대표 사진" : "사진"}
                      style={[styles.tile, { width: wide ? tile * 2 + GRID_GAP : tile, height: 104 }]}
                    >
                      <Image source={{ uri: photo.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      {diary.coverPhotoId === photo.photoId ? (
                        <View style={styles.coverBadge}>
                          <AppText variant="badge" color="white">
                            대표
                          </AppText>
                        </View>
                      ) : null}
                    </PressableScale>
                  </Animated.View>
                );
              })}
              {remaining > 0 ? (
                <PressableScale
                  onPress={openPhotoSheet}
                  disabled={upload.isPending}
                  scaleTo={0.96}
                  style={[styles.tile, styles.addTile, { width: diary.photos.length === 0 ? tile * 2 + GRID_GAP : tile, height: 104 }]}
                  accessibilityRole="button"
                  accessibilityLabel="사진 추가"
                >
                  {upload.isPending ? <ActivityIndicator color={colors.green} /> : <Icons.PhotoAdd width={20} height={20} />}
                  <AppText variant="badge" color="muted">
                    {upload.isPending ? "올리는 중" : "사진 추가"}
                  </AppText>
                </PressableScale>
              ) : null}
            </View>
            <AppText variant="badge" color="muted">
              사진을 누르면 대표 사진으로 정하거나 지울 수 있어요
            </AppText>

            <SectionHead title="어땠나요?" right={<Counter value={form.experienceTags.length} max={MAX_EXPERIENCE_TAGS} />} />
            <View style={styles.tags}>
              {EXPERIENCE_TAGS.map((tag) => {
                const on = form.experienceTags.includes(tag);
                return (
                  <PressableScale
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    haptic={false}
                    scaleTo={0.94}
                    style={[styles.tag, on && styles.tagOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={tag}
                  >
                    <AppText variant="small12" color={on ? "darkgreen" : "muted"} style={styles.medium}>
                      {tag}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>

            <SectionHead title="이야기" right={<Counter value={form.body.length} max={BODY_MAX} />} />
            <TextInput
              value={form.body}
              onChangeText={(v) => set("body", v)}
              maxLength={BODY_MAX}
              multiline
              placeholder="기억에 남는 장면, 함께한 사람, 다음에 또 가고 싶은 곳…"
              placeholderTextColor={colors.muted}
              style={styles.bodyInput}
              textAlignVertical="top"
              accessibilityLabel="여행기 본문"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomCTA>
        <Button label="다음" rightIcon={<Icons.CtaChevron width={17} height={17} />} disabled={!titleValid} onPress={() => setStep("settings")} />
      </BottomCTA>
      <PhotoSheet ref={sheetRef} remaining={remaining} onCamera={() => void takePhoto()} onAlbum={() => void pickFromAlbum()} onClose={() => sheetRef.current?.dismiss()} />
    </Screen>
  );
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <AppText variant="bold14">{title}</AppText>
      {right}
    </View>
  );
}

function Counter({ value, max, strong }: { value: number; max: number; strong?: boolean }) {
  return (
    <AppText variant="badge" color="muted" style={styles.bold}>
      <AppText variant="badge" color={strong && value > 0 ? "green" : "muted"} style={styles.bold}>
        {value}
      </AppText>
      {`/${max}`}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  medium: { fontFamily: fonts.medium },
  content: { paddingBottom: space[32] },
  hero: { paddingHorizontal: screenPadding, paddingTop: space[16], paddingBottom: 18, backgroundColor: "#F7FCF9", gap: space[4] },
  titleInput: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 30, color: colors.charcoal, paddingVertical: 2, paddingHorizontal: 0, includeFontPadding: false },
  rateRow: { flexDirection: "row", alignItems: "center", gap: space[12], marginTop: space[12] },
  body: { paddingHorizontal: screenPadding, gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space[16] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  tile: { borderRadius: 9, overflow: "hidden", backgroundColor: colors.surface },
  addTile: { alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderStyle: "dashed", borderColor: "#C9D1CC", backgroundColor: "#F6F8F6" },
  coverBadge: { position: "absolute", left: 6, top: 6, paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: colors.darkgreen },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  tagOn: { backgroundColor: colors.mint, borderColor: "#A7DFC1" },
  bodyInput: {
    minHeight: 140,
    padding: space[12],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.charcoal,
    includeFontPadding: false,
  },
  settings: { paddingHorizontal: screenPadding, paddingTop: space[8], paddingBottom: space[32] },
  block: { paddingVertical: 15, gap: space[12] },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -space[4] },
  divider: { height: 1, backgroundColor: colors.border },
  precisionRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  note: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: "#F6F8F6", marginTop: -space[4] },
  tasteCard: { flexDirection: "row", alignItems: "center", gap: space[12], padding: 15, borderRadius: 13, backgroundColor: colors.mint, marginTop: space[4] },
  tasteText: { color: "#5C7062", marginTop: 4 },
});
