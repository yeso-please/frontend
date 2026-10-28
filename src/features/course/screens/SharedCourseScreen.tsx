import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { courseShareApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { BottomCTA, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { screenPadding, space } from "@/theme";

import { CourseBody, type CourseTab } from "../components/CourseBody";
import { CourseHeader } from "../components/CourseHeader";
import { tripTitle } from "../format";

/** 더 이상 열 수 없는 링크: 없음·다른 용도·만료·취소, 여행이 지워져 세션이 사라짐 (4-12·4-13) */
const GONE = ["SHARE_LINK_NOT_FOUND", "SHARE_LINK_EXPIRED", "SHARE_LINK_REVOKED", "SHARE_SESSION_INVALID", "TOKEN_AUDIENCE_MISMATCH"];

/**
 * 공유받은 코스 (tripin://course/{token}) — 로그인 없이 읽기 전용으로 봅니다.
 * 4-12가 token을 쿠키로 바꿔 303으로 4-13(공유 코스)을 돌려주므로 fetch가 따라가 코스를 받습니다. 참여자 이름은 감춰져 옵니다.
 */
export function SharedCourseScreen({ token }: { token: string }) {
  const signedIn = useAuthStore((s) => s.status === "signedIn");
  const course = useQuery({ queryKey: queryKeys.sharedCourse(token), queryFn: () => courseShareApi.open(token), retry: 1 });
  const [tab, setTab] = useState<CourseTab>("all");
  const [dayIndex, setDayIndex] = useState(0);

  const close = () => (router.canGoBack() ? router.back() : router.replace(signedIn ? "/(tabs)" : "/login"));

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="공유받은 코스" onBack={close} />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  if (GONE.some((code) => isApiError(course.error, code))) {
    return (
      <Screen>
        <TopBar title="공유받은 코스" onBack={close} />
        <EmptyView title="더 이상 열 수 없는 링크예요" description="공유 링크가 만료됐거나 취소됐어요. 보낸 사람에게 새 링크를 받아 주세요." />
      </Screen>
    );
  }
  if (course.isError) {
    return (
      <Screen>
        <TopBar title="공유받은 코스" onBack={close} />
        <ErrorView error={course.error} onRetry={() => void course.refetch()} />
      </Screen>
    );
  }

  const data = course.data;
  const noCourse = data.days.length === 0;

  return (
    <Screen>
      <TopBar title="공유받은 코스" onBack={close} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CourseHeader
          title={data.title ?? tripTitle(data.regionName, "여행")}
          startDate={data.startDate}
          endDate={data.endDate}
          travelers={[]}
          line={{ text: "공유받은 코스예요 · 읽기만 할 수 있어요." }}
        />
        {noCourse ? (
          <EmptyView title="아직 코스가 없어요" description="함께하는 사람들이 코스를 만들면 이 링크에서 볼 수 있어요." />
        ) : (
          <CourseBody course={data} transport="CAR" tab={tab} onTabChange={setTab} dayIndex={dayIndex} onDayChange={setDayIndex} />
        )}
      </ScrollView>
      <BottomCTA>
        <Button
          label={signedIn ? "나도 여행 시작하기" : "TriPin 시작하기"}
          onPress={() => router.replace(signedIn ? "/(tabs)/travel" : "/login")}
          rightIcon={<Icons.ArrowRight width={20} height={20} />}
        />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[32], gap: space[24] },
});
