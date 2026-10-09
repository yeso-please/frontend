import { Text, type TextProps } from "react-native";

import { colors, type ColorName, typography, type TypographyVariant } from "@/theme";

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: "left" | "center" | "right";
};

export function AppText({ variant = "body", color, align, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant], color && { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
