/* global __dirname */
// One launcher icon per theme. MainActivity loses its own launcher entry and gets an activity-alias for each theme
// (only the default one enabled); modules/theme-icon switches them when the theme changes.
// The art comes from assets/icons/<id>-fg.png and <id>-bg.png (scripts/generate-icons.mjs).
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const ICONS = path.join(__dirname, "..", "assets", "icons")
const ids = () => fs.readdirSync(ICONS).filter((f) => f.endsWith("-fg.png")).map((f) => f.replace("-fg.png", "")).sort()

function withIconFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res")
      const nodpi = path.join(res, "drawable-nodpi")
      const anydpi = path.join(res, "mipmap-anydpi-v26")
      const legacy = path.join(res, "mipmap-nodpi")
      for (const dir of [nodpi, anydpi, legacy]) fs.mkdirSync(dir, { recursive: true })
      for (const id of ids()) {
        fs.copyFileSync(path.join(ICONS, `${id}-fg.png`), path.join(nodpi, `ic_theme_${id}_fg.png`))
        fs.copyFileSync(path.join(ICONS, `${id}-bg.png`), path.join(nodpi, `ic_theme_${id}_bg.png`))
        // Before Android 8 there are no adaptive icons: the finished picture is used
        fs.copyFileSync(path.join(ICONS, `${id}-full.png`), path.join(legacy, `ic_theme_${id}.png`))
        fs.writeFileSync(
          path.join(anydpi, `ic_theme_${id}.xml`),
          `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@drawable/ic_theme_${id}_bg" />\n  <foreground android:drawable="@drawable/ic_theme_${id}_fg" />\n  <monochrome android:drawable="@drawable/ic_theme_${id}_fg" />\n</adaptive-icon>\n`,
        )
      }
      return cfg
    },
  ])
}

function withAliases(config, { defaultId }) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0]
    const main = app.activity.find((a) => a.$["android:name"] === ".MainActivity")
    // Only the aliases launch the app now
    main["intent-filter"] = (main["intent-filter"] ?? []).filter(
      (f) => !(f.category ?? []).some((c) => c.$["android:name"] === "android.intent.category.LAUNCHER"),
    )
    app["activity-alias"] = (app["activity-alias"] ?? []).filter((a) => !a.$["android:name"].startsWith(".ThemeIcon_"))
    for (const id of ids()) {
      app["activity-alias"].push({
        $: {
          "android:name": `.ThemeIcon_${id}`,
          "android:targetActivity": ".MainActivity",
          "android:enabled": String(id === defaultId),
          "android:exported": "true",
          "android:icon": `@mipmap/ic_theme_${id}`,
          "android:label": "@string/app_name",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
          },
        ],
      })
    }
    return cfg
  })
}

module.exports = function withThemeIcons(config, props = {}) {
  config = withIconFiles(config)
  return withAliases(config, { defaultId: props.defaultId ?? "pixel" })
}
