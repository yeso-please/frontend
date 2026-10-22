import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Icons } from "@/components/icons";
import { secureImageUrl } from "@/lib/imageUrl";
import { colors, radius } from "@/theme";

type Props = { url: string | null | undefined; size?: { width: number; height: number }; label: string };

/** 장소·식당 썸네일. 사진이 없으면 핀 아이콘 자리 */
export function PlaceThumb({ url, size = { width: 72, height: 64 }, label }: Props) {
  const src = secureImageUrl(url);
  return (
    <View style={[styles.box, size]}>
      {src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} recyclingKey={src} accessibilityLabel={`${label} 사진`} />
      ) : (
        <Icons.PinDestination width={22} height={21} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
