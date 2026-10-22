import { StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/components/ui";
import { colors, fonts, radius, space } from "@/theme";

export const NOTE_MAX = 100;

type Props = { value: string; onChange: (value: string) => void; label: string; placeholder: string };

/** 5-3 REPLACE·REMOVE의 선택 사유(1~100자). 친구들이 변경 표시에서 봅니다 */
export function NoteField({ value, onChange, label, placeholder }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText variant="small13Bold">{label}</AppText>
        <AppText variant="small12" color="muted">{`${value.length}/${NOTE_MAX}`}</AppText>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={NOTE_MAX}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[8] },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space[16],
    paddingVertical: 0,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.charcoal,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
