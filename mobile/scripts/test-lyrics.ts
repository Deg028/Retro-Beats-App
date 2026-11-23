/**
 * Rules for which lyrics win (src/online/lyricsPolicy.ts). Run with `npm run test:lyrics`; it also runs on EAS before a build
 * (`eas-build-post-install`), so a change that lets worse lyrics replace better ones stops the build.
 * Each case is a mistake that really happened, or one that must never happen.
 */
import { groupByLetter, isJapanese, letterOf } from "../src/alphabet"
import { alignJapanese, japaneseSegments, looksLikeRomaji, mergeJapanese } from "../src/online/japanese"
import { isSectionLabel, lyricsToText, parseLrc, splitLyrics, tidyLyrics, toLrc } from "../src/online/lrclib"
import { artistKey, songsOf, summarize } from "../src/recap"
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

test("YouTube's captions of an instrumental are hidden; real lyrics with a few «oh» stay", () => {
  const timed = (texts: string[]) => ({ synced: texts.map((text, i) => ({ t: 5 + i * 20, text })), plain: null })
  const captions = tidyLyrics(timed(["[Music]", "so", "[Music]", "Heat.", "[Applause]", "[Music]", "Dr. Wily Stage"]))
  assert.equal(captions.synced, null)
  assert.equal(captions.plain, null)
  assert.equal(tidyLyrics({ synced: null, plain: "[Música]\nEste es contenido generado por inteligencia artificial\n[Música]" }).plain, null)
  // the review then counts it as a song with no lyrics
  assert.equal(reviewLyrics({ lyrics: true }, captions, 200).verdict, "none")
  const sung = tidyLyrics(timed(["Oh", "Corre sin mirar atrás", "La noche es nuestra", "Yeah", "Nunca vamos a parar", "Hasta el final"]))
  assert.equal(sung.synced?.length, 6)
})

test("lyrics timed by hand are saved as the person's timed lyrics, with the same times", () => {
  const lines = ["Primera línea", "Segunda línea", "Tercera línea", "Cuarta línea"]
  const lrc = toLrc(lines, [0, 12.345, 59.999, 125.5])
  const { synced, plain } = splitLyrics(lrc)
  assert.equal(JSON.stringify(synced?.map((l) => l.t)), JSON.stringify([0, 12.34, 59.99, 125.5]))
  assert.equal(synced?.[3].text, "Cuarta línea")
  assert.equal(plain, lines.join("\n"))
  // and they win over the timed lyrics of the internet and over guesses
  assert.equal(canReplace(q("estimated", true), q("manual", true)), true)
  assert.equal(canReplace(q("web", true), q("manual", true)), true)
})

test("lyrics that are only romaji get their Japanese back, on the person's times, with their reading kept", () => {
  const romajiText = "massugu korogatte nani mo nai nai tsumannai ne zutto wakarikitte dakara daremo kimi ni kizukanai samishii ne kore wa dou korobu ka nante wakannai hou ga tanoshii ne sore naraba"
  assert.equal(looksLikeRomaji(`${romajiText} ${romajiText}`.split(" ")), true)
  // English lyrics are not romaji, and a few words are not enough to tell
  assert.equal(looksLikeRomaji("I will always love you and the night is ours so take me home tonight we are the champions of the world tonight".split(" ")), false)
  assert.equal(looksLikeRomaji(["massugu korogatte", "nani mo nai"]), false)
  assert.equal(looksLikeRomaji([romajiText, "真っ直ぐ転がって"]), false)
  // the Japanese parts of a file name are what is searched
  assert.equal(JSON.stringify(japaneseSegments("イレギュラーマン_重音テトSV(MP3_320K).mp3")), JSON.stringify(["イレギュラーマン", "重音テトSV"]))
  assert.equal(JSON.stringify(japaneseSegments("やる気が出ない歌 _ 初音ミク・重音テト(MP3_320K).mp3")), JSON.stringify(["やる気が出ない歌", "初音ミク・重音テト"]))
  assert.equal(japaneseSegments("Irregular Man - Kasane Teto(MP3_320K).mp3").length, 0)
  // the same number of lines: one to one, the person's times and reading stay
  const romaji = [{ t: 14, text: "massugu korogatte" }, { t: 17, text: "nani mo nai nai tsumannai ne" }, { t: 19.5, text: "zutto wakarikitte" }]
  const japanese = [{ t: 14.8, text: "真っ直ぐ転がって" }, { t: 16.9, text: "何もないない　つまんないね" }, { t: 19.5, text: "ずっと分かりきって" }]
  const one = mergeJapanese(romaji, japanese, 180, 181)
  assert.equal(JSON.stringify(one?.synced), JSON.stringify([{ t: 14, text: "真っ直ぐ転がって" }, { t: 17, text: "何もないない　つまんないね" }, { t: 19.5, text: "ずっと分かりきって" }]))
  assert.equal(JSON.stringify(one?.romaji), JSON.stringify(romaji.map((l) => l.text)))
  // a different number of lines: matched by time when it is the same recording, otherwise left alone
  const many = Array.from({ length: 20 }, (_, i) => ({ t: 10 + i * 8, text: `日本語${i}` }))
  const manyRomaji = Array.from({ length: 20 }, (_, i) => ({ t: 10.5 + i * 8, text: `nihongo ${i}` }))
  assert.equal(mergeJapanese(manyRomaji.slice(0, 19), many, 180, 181)?.synced.length, 19)
  assert.equal(mergeJapanese(manyRomaji.slice(0, 19), many, 180, 200), null)
  assert.equal(mergeJapanese(manyRomaji.slice(0, 12), many, 180, 181), null)
})

test("Japanese and romaji written as separate lines become Japanese lines with their reading", () => {
  const pairs = [
    ["はーいはい もう今からやるって", "haai hai mou ima kara yarutte"],
    ["はーいはい やればできる子だって", "haai hai yareba dekiru ko datte"],
    ["はーいはい だからほっといてって", "haai hai dakara hottoite tte"],
    ["今やろうと思ってたのに", "ima yarou to omotteta no ni"],
    ["平行線 辿り焦燥", "heikousen tadori shousou"],
  ]
  const lyrics = { synced: pairs.flatMap(([ja, ro], i) => [{ t: i * 6, text: ja }, { t: i * 6 + 2, text: ro }]), plain: pairs.flat().join("\n") }
  const tidy = tidyLyrics(lyrics)
  assert.equal(JSON.stringify(tidy.synced?.map((l) => l.text)), JSON.stringify(pairs.map(([ja]) => ja)))
  assert.equal(JSON.stringify(tidy.synced?.map((l) => l.t)), JSON.stringify([0, 6, 12, 18, 24]))
  assert.equal(JSON.stringify(tidy.romaji), JSON.stringify(pairs.map(([, ro]) => ro)))
  assert.equal(tidy.plain, pairs.map(([ja]) => ja).join("\n"))
  assert.equal(JSON.stringify(tidy.plainRomaji), JSON.stringify(pairs.map(([, ro]) => ro)))
  // safe to run twice
  assert.equal(JSON.stringify(tidyLyrics(tidy)), JSON.stringify(tidy))
  // the reading may also come first
  const first = tidyLyrics({ synced: pairs.flatMap(([ja, ro], i) => [{ t: i * 6, text: ro }, { t: i * 6 + 2, text: ja }]), plain: null })
  assert.equal(JSON.stringify(first.synced?.map((l) => l.text)), JSON.stringify(pairs.map(([ja]) => ja)))
  assert.equal(JSON.stringify(first.romaji), JSON.stringify(pairs.map(([, ro]) => ro)))
  // an English translation under each line is not a reading: the lyrics are left as they are
  const english = ["The day has come", "Such a narrow world", "Poison ivy twists", "Staring through the fog", "Nothing left to lose"]
  const translated = tidyLyrics({ synced: pairs.flatMap(([ja], i) => [{ t: i * 6, text: ja }, { t: i * 6 + 2, text: english[i] }]), plain: null })
  assert.equal(translated.romaji, undefined)
})

test("lyrics copied to correct by hand keep times and romaji, and come back the same when pasted", () => {
  const song = {
    lyrics: [
      { t: 10, text: "はーいはい もう今からやるって" },
      { t: 14, text: "はーいはい やればできる子だって" },
      { t: 18, text: "今やろうと思ってたのに" },
      { t: 22, text: "NaNaNaNaNa" },
      { t: 26, text: "しょうもない" },
    ],
    romaji: ["haai hai mou ima kara yarutte", "haai hai yareba dekiru ko datte", "ima yarou to omotteta no ni", "", "shoumonai"],
    lyricsOffset: -1,
  }
  const text = lyricsToText(song)
  assert.equal(text.split("\n")[0], "[00:11.00] はーいはい もう今からやるって")
  assert.equal(text.split("\n")[1], "[00:11.00] haai hai mou ima kara yarutte")
  const { synced, plain } = splitLyrics(text)
  const back = tidyLyrics({ synced, plain: plain || null })
  assert.equal(JSON.stringify(back.synced?.map((l) => l.text)), JSON.stringify(song.lyrics.map((l) => l.text)))
  assert.equal(JSON.stringify(back.synced?.map((l) => l.t)), JSON.stringify([11, 15, 19, 23, 27]))
  assert.equal(JSON.stringify(back.romaji), JSON.stringify(song.romaji))
  // a reading Google gave with a stray accent is still a reading
  const accented = tidyLyrics(splitLyrics(lyricsToText({ ...song, romaji: song.romaji.map((r, i) => (i === 2 ? "tà Mare Ta Hana No Namae Mo Shirazu Ni" : r)) })))
  assert.equal(accented.synced?.length, 5)
  assert.equal(accented.romaji?.[2], "tà Mare Ta Hana No Namae Mo Shirazu Ni")
  // plain lyrics with their readings too
  assert.equal(lyricsToText({ plain: "今日\nhello", plainRomaji: ["kyou", ""] }), "今日\nkyou\nhello")
})

test("the artist of the year counts only songs by exactly that artist or group", () => {
  assert.equal(artistKey("Kasane Teto/ Hatsune Miku"), artistKey("Hatsune Miku & Kasane Teto"))
  assert.ok(artistKey("Kasane Teto") !== artistKey("Kasane Teto/ Hatsune Miku"))
  const log = {
    "2026-11": {
      "1": { s: 300, t: "Irregular Man", a: "Kasane Teto" },
      "2": { s: 200, t: "Tetoris", a: "Kasane Teto" },
      "3": { s: 900, t: "Unmotivated Song", a: "Kasane Teto/ Hatsune Miku" },
      "4": { s: 100, t: "PPPP", a: "Hatsune Miku, Kasane Teto" },
      "5": { s: 50, t: "Otro", a: "Creepy Nuts" },
    },
  }
  const sum = summarize(log, { kind: "year", key: "2026" })
  assert.equal(sum.artists[0].name, "Kasane Teto/ Hatsune Miku")
  assert.equal(sum.artists[0].seconds, 1000)
  assert.equal(JSON.stringify(songsOf(sum.songs, sum.artists[0].name).map((s) => s.name)), JSON.stringify(["Unmotivated Song", "PPPP"]))
  assert.equal(JSON.stringify(songsOf(sum.songs, "Kasane Teto").map((s) => s.name)), JSON.stringify(["Irregular Man", "Tetoris"]))
})

test("a one-word reading is folded too, and a Latin line repeated as its own «romaji» shows once (Unmotivated Song)", () => {
  const rows = [
    "はーいはい もう今からやるって", "haai hai mou ima kara yarutte",
    "はーいはい やればできる子だって", "haai hai yareba dekiru ko datte",
    "今やろうと思ってたのに", "ima yarou to omotteta no ni",
    "NaNaNaNaNa", "NaNaNaNaNa",
    "いつも難儀な状況 ホールドオン", "itsumo nangi na joukyou hoorudo on",
    "しょうもない", "shoumonai",
    "見ないふりだけ優等生", "minai furi dake yuutousei",
  ]
  const ja = ["はーいはい もう今からやるって", "はーいはい やればできる子だって", "今やろうと思ってたのに", "NaNaNaNaNa", "いつも難儀な状況 ホールドオン", "しょうもない", "見ないふりだけ優等生"]
  const reading = ["haai hai mou ima kara yarutte", "haai hai yareba dekiru ko datte", "ima yarou to omotteta no ni", "", "itsumo nangi na joukyou hoorudo on", "shoumonai", "minai furi dake yuutousei"]
  const tidy = tidyLyrics({ synced: rows.map((text, i) => ({ t: i * 3, text })), plain: null })
  assert.equal(JSON.stringify(tidy.synced?.map((l) => l.text)), JSON.stringify(ja))
  assert.equal(JSON.stringify(tidy.romaji), JSON.stringify(reading))
  assert.equal(JSON.stringify(tidyLyrics(tidy)), JSON.stringify(tidy))
  // lyrics an older version folded (the one-word reading and the copy left as lines) are mended when they are loaded
  const old = ja.flatMap((text, i) => (i === 3 ? [text, text] : i === 5 ? [text, "shoumonai"] : [text]))
  const oldReading = reading.flatMap((r, i) => (i === 3 ? ["", ""] : i === 5 ? ["", ""] : [r]))
  const mended = tidyLyrics({ synced: old.map((text, i) => ({ t: i * 3, text })), plain: null, romaji: oldReading })
  assert.equal(JSON.stringify(mended.synced?.map((l) => l.text)), JSON.stringify(ja))
  assert.equal(JSON.stringify(mended.romaji), JSON.stringify(reading))
  // saved interleaved, with a reading the app made under each Japanese line (seen on the phone): the source's romaji folds in and wins
  const appRead = rows.map((r) => (/[぀-ヿ㐀-鿿]/.test(r) ? "wa¯ i hai (app)" : ""))
  const raw = tidyLyrics({ synced: rows.map((text, i) => ({ t: i * 3, text })), plain: null, romaji: appRead })
  assert.equal(JSON.stringify(raw.synced?.map((l) => l.text)), JSON.stringify(ja))
  assert.equal(JSON.stringify(raw.romaji), JSON.stringify(reading.map((r, i) => r || (i === 3 ? "" : r))))
  // lyrics read by the app itself (every Japanese line has its reading) keep a chant sung twice
  const chant = ["今日も", "Hey Hey", "Hey Hey", "明日も", "昨日も", "いつも"]
  const own = tidyLyrics({ synced: chant.map((text, i) => ({ t: i * 3, text })), plain: null, romaji: ["kyou mo", "", "", "ashita mo", "kinou mo", "itsumo"] })
  assert.equal(own.synced?.length, 6)
})

test("el índice A-Z: letras, japonés bajo 和 y números bajo #", () => {
  assert.equal(letterOf("Irregular Man"), "I")
  assert.equal(letterOf("  \"My War\" Full English Cover"), "M")
  assert.equal(letterOf("Última Batalla"), "U")
  assert.equal(letterOf("ヤラララ Yararara"), "和")
  assert.equal(letterOf("やる気が出ない歌"), "和")
  assert.equal(letterOf("1-2 Subsuelo"), "#")
  const groups = groupByLetter([{ title: "Zeta" }, { title: "ヤラララ" }, { title: "alfa" }, { title: "7 Rings" }, { title: "Alba" }])
  assert.equal(groups.map((g) => g.letter).join(""), "AZ和#")
  assert.equal(groups[0].songs.map((x) => x.title).join(","), "alfa,Alba".split(",").sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(","))
  assert.ok(isJapanese({ title: "Irregular Man", artist: "重音テト" }))
  assert.ok(!isJapanese({ title: "Irregular Man", artist: "Kasane Teto" }))
})

test("el japonés se pone en las líneas de romaji aunque no tengan el mismo número de líneas", () => {
  const ja = ["真っ直ぐ転がって", "夢を見ていた", "空を飛びたい", "君に会いたい", "何度でも", "さよならの声", "光の中へ", "もう一度"]
  const reading = ["massugu korogatte", "yume o miteita", "sora o tobitai", "kimi ni aitai", "nando demo", "sayonara no koe", "hikari no naka e", "mō ichido"]
  // la letra de la persona: otra grafía, una línea repetida
  const mine = ["Massugu korogatte", "Yume wo miteita", "Sora wo tobitai", "Sora wo tobitai", "Kimi ni aitai", "Nando demo", "Sayonara no koe", "Hikari no naka e", "Mou ichido"]
  const lines = mine.map((text, i) => ({ t: i * 5, text }))
  const out = alignJapanese(lines, ja, reading)
  assert.ok(out !== null)
  assert.equal(out!.synced[0].text, "真っ直ぐ転がって")
  assert.equal(out!.synced[1].text, "夢を見ていた")
  assert.equal(out!.synced[4].text, "君に会いたい")
  assert.equal(out!.synced[8].text, "もう一度")
  assert.equal(out!.synced[8].t, 40)
  assert.equal(out!.romaji[4], "Kimi ni aitai")
  // la letra de otra canción no encaja
  assert.equal(alignJapanese(lines, ["全然違う", "ほかの歌", "知らない", "わからない"], ["zenzen chigau", "hoka no uta", "shiranai", "wakaranai"]), null)
})

console.log(`${passed} pruebas de letras correctas`)
