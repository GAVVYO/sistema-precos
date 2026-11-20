import { useState, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { pressTransition } from "@/theme/motion";

/**
 * Pressionar = encolher 3% (receita "press feedback" da skill expo-animation).
 * O retorno visual vem no toque (press-in), a ação no soltar.
 */
export function PressScale({ children, style, pressedStyle, containerStyle, scale = 0.97, ...props }: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  /** Largura/posição do toque (flex, alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  scale?: number;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...props}
      style={containerStyle}
      pressRetentionOffset={16}
      onPressIn={(e) => { setPressed(true); props.onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); props.onPressOut?.(e); }}
    >
      <Animated.View style={[style, pressTransition, { transform: [{ scale: pressed && !props.disabled ? scale : 1 }] }, pressed && pressedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
