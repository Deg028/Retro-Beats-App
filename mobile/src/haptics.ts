import * as Haptics from "expo-haptics"

// Short vibrations that confirm a gesture without looking: a tick for choosing (tab, filter, letter, favourite) and a
// firmer tap for playing or pausing. Phones without a vibrator, or with touch vibration off, just stay still.

/** Something was chosen: a tab, a filter, a letter of the index, a favourite */
export const tick = () => void Haptics.selectionAsync().catch(() => {})

/** Playback started or stopped */
export const tap = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
