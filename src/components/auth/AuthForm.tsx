import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icons } from "@/components/icons";
import { AppText } from "@/components/ui";
import { colors, fonts, motion, radius, screenPadding } from "@/theme";

/** 로그인·회원가입 화면 공통 레이아웃 (피그마 디자인 없음 — 토큰만 맞춘 기본 화면) */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(motion.spring.gentle.damping)} style={styles.logo}>
          <Icons.LogoPin width={29} height={28} />
          <AppText variant="logo">TriPin</AppText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(motion.stagger).springify()}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="body" color="muted" style={styles.subtitle}>
            {subtitle}
          </AppText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(motion.stagger * 2).springify()} style={styles.fields}>
          {children}
        </Animated.View>
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string };

export function Field({ label, error, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={colors.muted}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, style]}
      />
      {!!error && (
        <AppText variant="small12" style={{ color: colors.danger }}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: screenPadding, paddingTop: 72, paddingBottom: 24, gap: 28 },
  logo: { flexDirection: "row", alignItems: "center", gap: 6 },
  subtitle: { marginTop: 6 },
  fields: { gap: 16 },
  field: { gap: 6 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.charcoal,
    backgroundColor: colors.white,
  },
  inputFocused: { borderColor: colors.green, borderWidth: 1.5 },
  inputError: { borderColor: colors.danger },
});
