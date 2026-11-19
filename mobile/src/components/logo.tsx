import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, Keyframe, ReduceMotion } from "react-native-reanimated";

/**
 * Logo GAVYO com a águia que pousa (decisão 70): a águia entra do alto à direita,
 * desce planando e pousa ao lado do nome; com `flap`, bate as asas (PIN certo).
 */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const LAND = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 70 }, { translateY: -46 }, { rotate: "-14deg" }, { scale: 0.86 }] },
  60: { opacity: 1, transform: [{ translateX: -4 }, { translateY: 3 }, { rotate: "3deg" }, { scale: 1.02 }], easing: EASE },
  100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }, { scale: 1 }], easing: EASE },
}).duration(900).delay(150).reduceMotion(ReduceMotion.System);
const FLAP = new Keyframe({
  0: { transform: [{ translateY: 0 }, { scaleY: 1 }] },
  20: { transform: [{ translateY: -3 }, { scaleY: 0.82 }] },
  40: { transform: [{ translateY: -6 }, { scaleY: 1.04 }] },
  60: { transform: [{ translateY: -8 }, { scaleY: 0.86 }] },
  80: { transform: [{ translateY: -4 }, { scaleY: 1.02 }] },
  100: { transform: [{ translateY: 0 }, { scaleY: 1 }] },
}).duration(560).reduceMotion(ReduceMotion.System);

export function Logo({ flap, height = 48 }: { flap?: boolean; height?: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="GAVYO">
      <Image alt="" source={require("../../assets/brand/gavyo-nome.png")} style={{ height, width: height * (1030 / 278) }} resizeMode="contain" />
      <Animated.View key={flap ? "flap" : "land"} entering={flap ? FLAP : LAND}>
        <Image alt="" source={require("../../assets/brand/gavyo-aguia.png")} style={{ height: height * 1.08, width: height * 1.08 * (437 / 284) }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 10 } });
