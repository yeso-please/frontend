import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { errorMessage } from "@/api/errors";
import { Icons } from "@/components/icons";
import { colors, radius } from "@/theme";

import { AppText } from "./AppText";
import { Button } from "./Button";

// 노션 디자인 컨벤션: 목록 화면은 Loading / Empty / Error 상태를 반드시 둔다.

export function LoadingView({ label = "불러오는 중이에요" }: { label?: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(-8, { duration: 520 }), -1, true);
  }, [y]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View entering={FadeIn.delay(150)} style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Animated.View style={bounce}>
        <Icons.PinDestination width={36} height={34} />
      </Animated.View>
      <AppText variant="small13" color="muted">
        {label}
      </AppText>
    </Animated.View>
  );
}

export function EmptyView({ title, description, actionLabel, onAction }: { title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Animated.View entering={FadeIn} style={styles.center}>
      <View style={styles.badge}>
        <Icons.LogoPin width={29} height={28} />
      </View>
      <AppText variant="label" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" color="muted" align="center">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} variant="secondary" onPress={onAction} height={44} style={styles.action} /> : null}
    </Animated.View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Animated.View entering={FadeIn} style={styles.center}>
      <AppText variant="label" align="center">
        문제가 생겼어요
      </AppText>
      <AppText variant="body" color="muted" align="center">
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button label="다시 시도" variant="neutral" onPress={onRetry} height={44} style={styles.action} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  badge: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  action: { marginTop: 8, paddingHorizontal: 24 },
});
