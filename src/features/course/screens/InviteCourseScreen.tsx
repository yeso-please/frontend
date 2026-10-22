import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { inviteApi } from "@/api/endpoints";
import { isApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { Icons } from "@/components/icons";
import { BottomCTA, Button, EmptyView, ErrorView, LoadingView, Screen, TopBar } from "@/components/ui";
import { useAuthStore } from "@/store/auth";
import { screenPadding, space } from "@/theme";

import { CourseBody, type CourseTab } from "../components/CourseBody";
import { CourseHeader } from "../components/CourseHeader";
import { tripTitle } from "../format";

/** 피그마 E4 여행 둘러보기 — 초대 링크로 수락 전에 코스를 읽기 전용으로 봅니다 (4-16, 로그인 불필요, 참여자 이름 공개) */
export function InviteCourseScreen({ token }: { token: string }) {
  const signedIn = useAuthStore((s) => s.status === "signedIn");
  const course = useQuery({ queryKey: queryKeys.inviteCourse(token), queryFn: () => inviteApi.course(token), retry: 1 });
  const preview = useQuery({ queryKey: queryKeys.invitePreview(token), queryFn: () => inviteApi.preview(token), retry: 1 });
  const [tab, setTab] = useState<CourseTab>("all");
  const [dayIndex, setDayIndex] = useState(0);

  const backToInvite = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/invite/[token]", params: { token } }));

  if (course.isPending) {
    return (
      <Screen>
        <TopBar title="여행 둘러보기" />
        <LoadingView label="코스를 불러오는 중이에요" />
      </Screen>
    );
  }
  const gone = ["INVITE_EXPIRED", "INVITE_REVOKED", "INVITE_NOT_FOUND"].some((code) => isApiError(course.error, code));
  if (gone) {
    return (
      <Screen>
        <TopBar title="여행 둘러보기" />
        <EmptyView title="더 이상 열 수 없는 초대예요" description="초대 링크가 만료됐거나 취소됐어요. 친구에게 새 링크를 받아 주세요." />
      </Screen>
    );
  }
  if (course.isError) {
    return (
      <Screen>
        <TopBar title="여행 둘러보기" />
        <ErrorView error={course.error} onRetry={() => course.refetch()} />
      </Screen>
    );
  }

  const data = course.data;
  const travelers = (preview.data?.participants ?? []).map((p) => p.nickname);
  const noCourse = data.days.length === 0;

  return (
    <Screen>
      <TopBar title="여행 둘러보기" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CourseHeader
          title={tripTitle(data.regionName ?? preview.data?.regionName, preview.data?.title ?? "여행")}
          startDate={data.startDate}
          endDate={data.endDate}
          travelers={travelers}
          line={{ text: "둘러보기 모드 · 편집하려면 여행에 참여해주세요." }}
        />
        {noCourse ? (
          <EmptyView title="아직 코스가 없어요" description="여행에 참여하면 친구들과 함께 첫 코스를 만들고 다듬을 수 있어요." />
        ) : (
          <CourseBody course={data} transport="CAR" tab={tab} onTabChange={setTab} dayIndex={dayIndex} onDayChange={setDayIndex} />
        )}
      </ScrollView>
      <BottomCTA>
        <Button
          label={signedIn ? "초대 수락하고 참여하기" : "회원가입하고 참여하기"}
          onPress={backToInvite}
          rightIcon={<Icons.ArrowRight width={20} height={20} />}
        />
      </BottomCTA>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenPadding, paddingTop: space[24], paddingBottom: space[32], gap: space[24] },
});
