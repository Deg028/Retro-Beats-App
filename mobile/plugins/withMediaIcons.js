/* global __dirname */
// Copies the drawables of the media notification (bigger previous and next arrows) into the Android project,
// where the patched expo-audio service finds them by name (see patches/expo-audio+*.patch)
const { withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

module.exports = function withMediaIcons(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const target = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable")
      const source = path.join(__dirname, "media-icons")
      fs.mkdirSync(target, { recursive: true })
      for (const file of fs.readdirSync(source)) fs.copyFileSync(path.join(source, file), path.join(target, file))
      return cfg
    },
  ])
}
