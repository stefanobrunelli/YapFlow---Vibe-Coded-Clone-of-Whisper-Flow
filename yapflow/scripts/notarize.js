/**
 * Apple Notarization Script
 *
 * Run after electron-builder packages the app. Requires:
 *   - APPLE_ID env var (your Apple Developer account email)
 *   - APPLE_ID_PASSWORD env var (app-specific password from appleid.apple.com)
 *   - APPLE_TEAM_ID env var (from developer.apple.com)
 *
 * To enable, uncomment `afterSign` in electron-builder.yml.
 */

// Uncomment and install @electron/notarize to enable:
// const { notarize } = require('@electron/notarize');
//
// exports.default = async function notarizing(context) {
//   const { electronPlatformName, appOutDir } = context;
//   if (electronPlatformName !== 'darwin') return;
//
//   const appName = context.packager.appInfo.productFilename;
//
//   return await notarize({
//     tool: 'notarytool',
//     appBundleId: 'com.promptflow.lite',
//     appPath: `${appOutDir}/${appName}.app`,
//     appleId: process.env.APPLE_ID,
//     appleIdPassword: process.env.APPLE_ID_PASSWORD,
//     teamId: process.env.APPLE_TEAM_ID,
//   });
// };

exports.default = async function noop() {
  // Notarization disabled. Enable by following the instructions above.
};
