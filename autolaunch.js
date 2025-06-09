const AutoLaunch = require("auto-launch")

const appLauncher = new AutoLaunch({
	name: "FriendlyFire",
	path: process.execPath,
})

appLauncher.isEnabled().then((isEnabled) => {
	if (!isEnabled) appLauncher.enable()
})