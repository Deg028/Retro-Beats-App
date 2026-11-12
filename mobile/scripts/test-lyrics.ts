/**
 * Rules for which lyrics win (src/online/lyricsPolicy.ts). Run with `npm run test:lyrics`; it also runs on EAS before a build
 * (`eas-build-post-install`), so a change that lets worse lyrics replace better ones stops the build.
 * Each case is a mistake that really happened, or one that must never happen.
 */
import { isSectionLabel, parseLrc, tidyLyrics } from "../src/online/lrclib"
import { canReplace, inferSource, isSnaptubeFile, LyricsSource, Quality, rank, reviewLyrics, wanted, worthBackingUp } from "../src/online/lyricsPolicy"

// No Node typings in this project: a minimal assert and the exit code
declare const process: { exitCode?: number }
const assert = {
  equal<T>(actual: T, expected: T) {
    if (actual !== expected) throw new Error(`se esperaba ${JSON.stringify(expected)} y salió ${JSON.stringify(actual)}`)
  },
  ok(value: boolean) {
    if (!value) throw new Error("se esperaba verdadero")
  },
}

const q = (source: LyricsSource, synced: boolean): Quality => ({ source, synced })
let passed = 0
const test = (name: string, fn: () => void) => {
  try {
    fn()
    passed++
  } catch (e) {
    console.error(`FALLA: ${name}\n`, e instanceof Error ? e.message : e)
    process.exitCode = 1
  }
}

test("timed lyrics from the internet beat anything that is not the person's", () => {
  assert.ok(rank(q("web", true)) > rank(q("snaptube", true)))
  assert.ok(rank(q("web", true)) > rank(q("embedded", true)))
  assert.ok(rank(q("web", true)) > rank(q("web", false)))
  assert.ok(rank(q("file", false)) > rank(q("web", true)))
  assert.ok(rank(q("manual", false)) > rank(q("web", true)))
})

test("Yararara: SnapTube's plain _private.lrc is replaced by the timed lyrics found online", () => {
  assert.equal(canReplace(q("snaptube", false), q("web", true)), true)
  // and an entry an earlier build marked as the person's own from that file is read as SnapTube's, not manual
  assert.equal(inferSource({ manualLyrics: true, lyricsFile: "content://x/Song(MP3_320K)_private.lrc" }), "snaptube")
})

test("untimed words never replace timed lyrics", () => {
  assert.equal(canReplace(q("web", true), q("web", false)), false)
  assert.equal(canReplace(q("embedded", true), q("web", false)), false)
  assert.equal(canReplace(q("web", true), q("snaptube", false)), false)
  assert.equal(canReplace(q("web", true), q("embedded", false)), false)
})

test("SnapTube's file and the MP3's tag never replace timed lyrics from the internet", () => {
  assert.equal(canReplace(q("web", true), q("snaptube", true)), false)
  assert.equal(canReplace(q("web", true), q("embedded", true)), false)
})

test("guessed times only fill in untimed words that are not the person's", () => {
  assert.equal(canReplace(q("web", true), q("estimated", true)), false)
  assert.equal(canReplace(q("manual", true), q("estimated", true)), false)
  assert.equal(canReplace(q("manual", false), q("estimated", true)), false)
  assert.equal(canReplace(q("file", false), q("estimated", true)), false)
  assert.equal(canReplace(q("web", false), q("estimated", true)), true)
  assert.equal(canReplace(q("snaptube", false), q("estimated", true)), true)
  assert.equal(canReplace(q("estimated", true), q("estimated", true)), true)
  assert.equal(canReplace(null, q("estimated", true)), true)
})

test("real timed lyrics replace guesses and untimed words", () => {
  assert.equal(canReplace(q("estimated", true), q("web", true)), true)
  assert.equal(canReplace(q("web", false), q("web", true)), true)
  assert.equal(canReplace(q("embedded", false), q("web", true)), true)
  assert.equal(canReplace(null, q("web", false)), true)
})

test("the person's own lyrics win; searches never replace them", () => {
  assert.equal(canReplace(q("web", true), q("manual", false)), true)
  assert.equal(canReplace(q("web", true), q("file", true)), true)
  assert.equal(canReplace(q("manual", true), q("web", true)), false)
  assert.equal(canReplace(q("file", true), q("web", true)), false)
  assert.equal(canReplace(q("manual", false), q("web", true)), false)
})

test("«Sincronizar» (explicit) may give the person's untimed words timed lyrics, but never touches their timed ones", () => {
  assert.equal(canReplace(q("manual", false), q("web", true), true), true)
  assert.equal(canReplace(q("file", false), q("web", true), true), true)
  assert.equal(canReplace(q("manual", true), q("web", true), true), false)
  assert.equal(canReplace(q("web", true), q("web", false), true), false)
})

test("a lyrics file's source is told from SnapTube's", () => {
  assert.equal(isSnaptubeFile("file:///x/Name(MP3_160K)_private.lrc"), true)
  assert.equal(isSnaptubeFile("file:///x/Supersonic Fire.lrc"), false)
  assert.equal(inferSource({ manualLyrics: true, lyricsFile: "file:///x/Supersonic Fire.lrc" }), "file")
  assert.equal(inferSource({ manualLyrics: true }), "manual")
  assert.equal(inferSource({ embeddedLyricsAt: 1 }), "embedded")
  assert.equal(inferSource({ embeddedLyricsAt: 1, lyricsFor: 200 }), "web")
  assert.equal(inferSource({}, { estimated: true }), "estimated")
  assert.equal(inferSource({}), "web")
})

test("replacing real timed lyrics keeps a copy; guesses and untimed words do not", () => {
  assert.equal(worthBackingUp(q("web", true)), true)
  assert.equal(worthBackingUp(q("manual", true)), true)
  assert.equal(worthBackingUp(q("estimated", true)), false)
  assert.equal(worthBackingUp(q("web", false)), false)
  assert.equal(worthBackingUp(null), false)
})

test("what is looked up", () => {
  const now = 1_000_000_000_000
  const WEEK = 7 * 24 * 3600 * 1000
  const song = { duration: 200 }
  // never looked up
  assert.equal(wanted(song, undefined, false, now).lyrics, true)
  // waits for the length
  assert.equal(wanted({ duration: 0 }, undefined, false, now).lyrics, false)
  // the person's own lyrics: no automatic search, but «Sincronizar» searches
  const own = { lyrics: true, lyricsAt: now, lyricsFor: 200, lyricsV: 2, manualLyrics: true, lyricsSynced: false }
  assert.equal(wanted(song, own, false, now).lyrics, false)
  assert.equal(wanted(song, own, true, now).lyrics, true)
  // timed lyrics already found: left alone
  const timed = { lyrics: true, lyricsAt: now, lyricsFor: 200, lyricsV: 2, lyricsSynced: true, cover: "x" }
  assert.equal(wanted(song, timed, false, now).lyrics, false)
  // only plain words: a timed version is looked for again after a week, not before
  const plain = { lyrics: true, lyricsAt: now, lyricsFor: 200, lyricsV: 2, lyricsSynced: false, syncTriedAt: now }
  assert.equal(wanted(song, plain, false, now + 1000).lyrics, false)
  assert.equal(wanted(song, plain, false, now + WEEK + 1000).lyrics, true)
  // lyrics saved with no known length are looked up again
  assert.equal(wanted(song, { ...timed, lyricsFor: undefined }, false, now).lyrics, true)
})

test("SnapTube's plain .lrc has no time tags, so it is read as plain words", () => {
  assert.equal(parseLrc("ヤラララ\n「おい」\n「なんでｿﾝﾅことやってんの？」").length, 0)
  assert.equal(parseLrc("[00:05.00] hola\n[00:09.50] adiós\n[00:12.00] fin").length, 3)
})

test("review of saved lyrics", () => {
  const lyrics = (times: number[], extra = {}) => ({ synced: times.map((t, i) => ({ t, text: `línea ${i}` })), plain: "x", ...extra })
  const has = { lyrics: true }
  assert.equal(reviewLyrics(undefined, null, 200).verdict, "none")
  assert.equal(reviewLyrics(has, { synced: null, plain: "words" }, 200).verdict, "plain")
  assert.equal(reviewLyrics(has, { ...lyrics([20, 60, 100]), estimated: true }, 200).verdict, "estimated")
  assert.equal(reviewLyrics(has, lyrics([10, 40, 80, 120, 160, 190]), 200).verdict, "ok")
  // timings that run past the end of the song: made for a longer version
  assert.equal(reviewLyrics(has, lyrics([10, 60, 120, 180, 240, 300]), 200).verdict, "suspect")
  // made for a recording of another length
  assert.equal(reviewLyrics(has, lyrics([10, 40, 80, 120, 160, 190], { duration: 258 }), 200).verdict, "suspect")
  // YouTube's automatic captions with nothing sung
  const junk = { synced: ["[Music]", "so", "Heat.", "[Music]", "[Music]", "so"].map((text, i) => ({ t: 10 + i * 30, text })), plain: null }
  assert.equal(reviewLyrics(has, junk, 200).verdict, "suspect")
  // a song that only covers a small part of the recording
  assert.equal(reviewLyrics(has, lyrics([10, 12, 14, 16, 18, 20]), 200).verdict, "suspect")
})

test("headings of the parts of a song are not lyrics", () => {
  for (const label of ["[Verse 1]", "[Chorus: Kasane Teto]", "[Pre-Chorus]", "Coro:", "(Coro)", "Estribillo", "Verso 2:", "Chorus x2", "(x2)", "[Instrumental]", "[Music]", "Puente", "Outro:", "Intro", "Hook", "【Chorus】"])
    assert.equal(isSectionLabel(label), true)
  // sung lines that only start with such a word stay
  for (const line of ["Hook, line and sinker", "Intro de mi vida", "Solo tú y yo", "Break my heart again", "Coro de ángeles cantando", "verso a verso te escribo", "「おい」", "(oh oh oh)", "Chorus of angels in my head tonight"])
    assert.equal(isSectionLabel(line), false)
})

test("lyrics keep only what is sung, timed or not, and timings stay", () => {
  const timed = tidyLyrics({
    synced: [
      { t: 1, text: "[Verse 1]" },
      { t: 2, text: "Primera línea" },
      { t: 6, text: "Coro:" },
      { t: 7, text: "Esto se canta (x2)" },
      { t: 12, text: "[Outro]" },
    ],
    plain: "[Verse 1]\nPrimera línea\n\nCoro:\nEsto se canta (x2)\n[Outro]",
  })
  assert.equal(JSON.stringify(timed.synced), JSON.stringify([{ t: 2, text: "Primera línea" }, { t: 7, text: "Esto se canta" }]))
  assert.equal(timed.plain, "Primera línea\n\nEsto se canta")
  // a reading made for those lines follows the ones that stay
  const read = tidyLyrics({ synced: [{ t: 1, text: "[Chorus]" }, { t: 2, text: "おい" }], plain: null, romaji: ["", "oi"] })
  assert.equal(JSON.stringify(read.romaji), JSON.stringify(["oi"]))
  // lyrics that were only headings are nothing
  const empty = tidyLyrics({ synced: [{ t: 1, text: "[Instrumental]" }], plain: "[Instrumental]" })
  assert.equal(empty.synced, null)
  assert.equal(empty.plain, null)
  // safe to run twice
  assert.equal(JSON.stringify(tidyLyrics(timed)), JSON.stringify(timed))
})

console.log(`${passed} pruebas de letras correctas`)
