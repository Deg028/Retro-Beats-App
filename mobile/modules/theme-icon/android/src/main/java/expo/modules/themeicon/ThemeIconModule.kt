package expo.modules.themeicon

import android.content.ComponentName
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Switches the launcher icon between the activity aliases that plugins/withThemeIcons.js adds to the manifest,
 * one per theme: the alias of the chosen theme is enabled and the others are disabled.
 */
class ThemeIconModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThemeIcon")

    Function("setIcon") { id: String, all: List<String> ->
      val context = appContext.reactContext ?: return@Function false
      val pm = context.packageManager
      val pkg = context.packageName
      fun alias(name: String) = ComponentName(pkg, "$pkg.ThemeIcon_$name")
      try {
        // Enable the new one first so the app never has a moment without a launcher entry
        pm.setComponentEnabledSetting(alias(id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
        for (other in all) {
          if (other != id) pm.setComponentEnabledSetting(alias(other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
        }
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
