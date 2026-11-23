import { StyleSheet, useWindowDimensions, View } from "react-native"
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg"
import { useTheme } from "../themes/ThemeContext"

/**
 * The sky behind the top of every screen in themes that have one (`theme.aurora`): three soft blots of colour that
 * fade into the background, like the glow left after the sun goes down. Radial gradients only, so it costs one
 * drawing and no picture file.
 */
export function Aurora() {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  if (!theme.aurora) return null
  const [a, b, c] = theme.aurora
  const height = 420
  const blots = [
    { id: "a", color: a, cx: width * 0.05, cy: 40, rx: width * 0.55, ry: 190, opacity: 0.75 },
    { id: "b", color: b, cx: width * 0.55, cy: 70, rx: width * 0.5, ry: 160, opacity: 0.55 },
    { id: "c", color: c, cx: width * 0.75, cy: 150, rx: width * 0.32, ry: 110, opacity: 0.35 },
  ]
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          {blots.map((x) => (
            <RadialGradient key={x.id} id={x.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={x.color} stopOpacity={x.opacity} />
              <Stop offset="0.55" stopColor={x.color} stopOpacity={x.opacity * 0.35} />
              <Stop offset="1" stopColor={x.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blots.map((x) => (
          <Ellipse key={x.id} cx={x.cx} cy={x.cy} rx={x.rx} ry={x.ry} fill={`url(#${x.id})`} />
        ))}
      </Svg>
    </View>
  )
}
