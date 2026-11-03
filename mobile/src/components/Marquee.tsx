import { useEffect, useRef, useState } from "react"
import { Animated, ScrollView, ScrollViewInstance, StyleProp, TextStyle, View } from "react-native"
import { T } from "./ui"
import { TextRole } from "../themes/themes"

/** Pixels per second the text slides while it plays */
const SPEED = 40
const PAUSE_START = 1400
const PAUSE_END = 900
/** Room left after the last letter, so it doesn't end against the edge */
const TAIL = 24

/**
 * A single line of text. When `moving` is on and the text is longer than the room it has, it slides to the left so the
 * whole title can be read, waits at the end and starts again; otherwise it is the usual line cut with "…".
 */
export function Marquee({ children, variant, color, style, moving }: { children: string; variant: TextRole; color?: string; style?: StyleProp<TextStyle>; moving: boolean }) {
  const [boxWidth, setBoxWidth] = useState(0)
  const [textWidth, setTextWidth] = useState(0)
  const scroller = useRef<ScrollViewInstance>(null)
  const overflow = boxWidth > 0 && textWidth > boxWidth + 1
  const run = moving && overflow

  useEffect(() => {
    const box = scroller.current
    if (!run) return
    const x = new Animated.Value(0)
    const sub = x.addListener(({ value }) => box?.scrollTo({ x: value, animated: false }))
    const distance = textWidth - boxWidth + TAIL
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE_START),
        Animated.timing(x, { toValue: distance, duration: (distance / SPEED) * 1000, easing: (t) => t, useNativeDriver: false }),
        Animated.delay(PAUSE_END),
        Animated.timing(x, { toValue: 0, duration: 250, useNativeDriver: false }),
      ]),
    )
    loop.start()
    return () => {
      loop.stop()
      x.removeListener(sub)
      box?.scrollTo({ x: 0, animated: false })
    }
  }, [run, textWidth, boxWidth])

  return (
    <View onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)} style={{ overflow: "hidden" }}>
      {/* Measures how wide the text wants to be: in a horizontal scroll view nothing narrows it */}
      <ScrollView
        horizontal
        scrollEnabled={false}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", opacity: 0, left: 0, right: 0, height: 0 }}
        onContentSizeChange={(w) => setTextWidth(w)}
      >
        <T variant={variant} style={style} numberOfLines={1}>
          {children}
        </T>
      </ScrollView>
      {run ? (
        <ScrollView ref={scroller} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: TAIL }}>
          <T variant={variant} color={color} style={style} numberOfLines={1}>
            {children}
          </T>
        </ScrollView>
      ) : (
        <T variant={variant} color={color} style={style} numberOfLines={1}>
          {children}
        </T>
      )}
    </View>
  )
}
