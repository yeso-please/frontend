import { StyleSheet, TextInput, View } from "react-native";

import { Icons } from "@/components/icons";
import { PressableScale } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  maxLength?: number;
};

/** 후보·식당 이름 검색 입력 */
export function SearchField({ value, onChange, placeholder, onSubmit, maxLength = 50 }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        maxLength={maxLength}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={styles.input}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <PressableScale onPress={() => onChange("")} haptic="tick" hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel="검색어 지우기">
          <Icons.Close width={16} height={16} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.md, backgroundColor: colors.surface, paddingLeft: space[16], paddingRight: space[8] },
  input: { flex: 1, height: 44, paddingVertical: 0, fontFamily: fonts.regular, fontSize: 14, color: colors.charcoal, includeFontPadding: false, textAlignVertical: "center" },
  clear: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
