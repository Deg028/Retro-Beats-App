import Constants from "expo-constants"

/** "v0.2.3 alpha": the version in app.json and the stage of the release. Shown on the opening and at the end of the side menu. */
export const VERSION_LABEL = `v${Constants.expoConfig?.version ?? "?"} alpha`
