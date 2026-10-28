import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";

import { KAKAO_JS_KEY, KAKAO_MAP_ORIGIN } from "@/api/config";
import { Icons } from "@/components/icons";
import { AppText, Button } from "@/components/ui";
import { colors, radius } from "@/theme";

import { buildMapHtml, parseMapMessage, sanitizeAppKey, toRenderScript } from "./html";
import type { MapBounds, MapMarker, MapPolyline } from "./types";

type Status = "loading" | "ready" | "error";

type Props = {
  markers: MapMarker[];
  polylines?: MapPolyline[];
  /** 값이 바뀌면 모든 점이 보이게 범위를 다시 맞춥니다 (예: 후보 목록이 바뀔 때) */
  fitKey?: string | number;
  /** 이 점으로 지도를 옮깁니다 (선택한 후보) */
  focusId?: string | null;
  onMarkerPress?: (id: string) => void;
  /** 지도를 움직이고 멈출 때마다 보이는 범위 */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** 지도를 만지는 동안 true — 부모 ScrollView 스크롤을 잠깐 끄는 데 씁니다 */
  onInteractionChange?: (active: boolean) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

const APP_KEY = sanitizeAppKey(KAKAO_JS_KEY);

/**
 * 카카오맵 JS SDK를 웹뷰로 띄웁니다. 페이지 출처(KAKAO_MAP_ORIGIN)가 카카오 디벨로퍼스 Web 플랫폼 도메인에
 * 등록돼 있어야 지도가 뜹니다. 키가 없거나 SDK를 못 받으면 "지도를 불러오지 못했어요"를 보여 주고,
 * 화면의 목록은 그대로 쓸 수 있습니다.
 */
export function KakaoMapView({ markers, polylines = [], fitKey = 0, focusId = null, onMarkerPress, onBoundsChange, onInteractionChange, style, accessibilityLabel }: Props) {
  const webRef = useRef<WebView>(null);
  const [status, setStatus] = useState<Status>(APP_KEY ? "loading" : "error");
  const [reloadKey, setReloadKey] = useState(0);
  const fittedKey = useRef<string | number | null>(null);
  const html = useMemo(() => buildMapHtml(APP_KEY), []);

  // 준비되면, 그리고 점·선·선택이 바뀔 때마다 다시 그립니다. 범위 맞추기는 fitKey가 바뀔 때만 합니다.
  useEffect(() => {
    if (status !== "ready") return;
    const fit = fittedKey.current !== fitKey;
    fittedKey.current = fitKey;
    webRef.current?.injectJavaScript(toRenderScript({ markers, polylines, fit, focusId }));
  }, [status, markers, polylines, fitKey, focusId]);

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseMapMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === "ready") setStatus("ready");
    else if (msg.type === "error") setStatus((s) => (s === "ready" && msg.reason === "render" ? s : "error"));
    else if (msg.type === "markerPress") onMarkerPress?.(msg.id);
    else if (msg.type === "bounds") onBoundsChange?.({ minLat: msg.minLat, minLng: msg.minLng, maxLat: msg.maxLat, maxLng: msg.maxLng, level: msg.level });
  };

  // 지도 안의 카카오 로고·링크는 앱 밖 브라우저로 엽니다.
  const onShouldStart = (req: WebViewNavigation) => {
    const url = req.url;
    if (url.startsWith(KAKAO_MAP_ORIGIN) || url.startsWith("about:") || url.startsWith("data:")) return true;
    if (/^https?:\/\//.test(url)) Linking.openURL(url).catch(() => undefined);
    return false;
  };

  const retry = () => {
    fittedKey.current = null;
    setStatus(APP_KEY ? "loading" : "error");
    setReloadKey((k) => k + 1);
  };

  return (
    <View
      style={[styles.frame, style]}
      accessible={status !== "ready"}
      accessibilityLabel={accessibilityLabel}
      onTouchStart={() => onInteractionChange?.(true)}
      onTouchEnd={() => onInteractionChange?.(false)}
      onTouchCancel={() => onInteractionChange?.(false)}
    >
      {APP_KEY && status !== "error" ? (
        <WebView
          key={reloadKey}
          ref={webRef}
          source={{ html, baseUrl: KAKAO_MAP_ORIGIN }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStart}
          onError={() => setStatus("error")}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Android 웹뷰는 부모의 borderRadius 클리핑을 무시하는데, 불투명도를 1 아래로 두면 잘립니다.
          style={styles.web}
        />
      ) : null}

      {status === "loading" ? (
        <Animated.View exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.cover]} pointerEvents="none">
          <Icons.PinDestination width={28} height={26} />
          <AppText variant="small12" color="muted">
            지도를 불러오는 중이에요
          </AppText>
        </Animated.View>
      ) : null}

      {status === "error" ? (
        <Animated.View entering={FadeIn} style={[StyleSheet.absoluteFill, styles.cover]}>
          <Icons.PinDestination width={28} height={26} />
          <AppText variant="small13Bold">지도를 불러오지 못했어요</AppText>
          <AppText variant="small12" color="muted" align="center">
            {APP_KEY ? "목록에서 장소를 확인할 수 있어요." : "카카오맵 키가 설정되지 않았어요. 목록에서 장소를 확인해 주세요."}
          </AppText>
          {APP_KEY ? <Button label="다시 불러오기" variant="neutral" height={36} onPress={retry} style={styles.retry} /> : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  web: { flex: 1, backgroundColor: colors.surface, opacity: 0.99 },
  cover: { alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 24, backgroundColor: colors.surface },
  retry: { marginTop: 6, paddingHorizontal: 20 },
});
