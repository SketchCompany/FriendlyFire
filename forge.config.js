const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const TOKENS = require("./tokens")

module.exports = {
  packagerConfig: {
    asar: true,
    icon: "app"
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'SketchCompany',
          name: 'FriendlyFire'
        },
        prerelease: false,
        draft: true,
        authToken: TOKENS.GITHUB_PUBLISH_TOKEN
      }
    }
  ],
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: "Sketch Company",
        description: "The official Friendly Fire file transmitter of the Sketch Company.",
        noMsi: "false",
        iconUrl: "https://sketch-company.de/res?f=friendlyfire/icon.png",
        icon: "app.ico",
        title: "Friendly Fire",
        setupIcon: "app.ico",
        loadingGif: "app.ico"
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ["darwin", "windows", "linux"],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: "app.png",
          bin: "FriendlyFire",
          maintainer: "Sketch Company",
          homepage: "https://sketch-company.de"
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: "app.png",
          bin: "FriendlyFire",
          maintainer: "Sketch Company",
          homepage: "https://sketch-company.de"
        }
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: "app.icns"
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
