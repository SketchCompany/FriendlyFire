const {app} = require("electron")
const path = require("path")
const fs = require("fs")

const globalDir = app.getPath("userData") + "/"
const defaultDir = app.isPackaged ? path.parse(app.getPath("exe")).dir + "/" : __dirname + "/"
const dataDir = globalDir + "/data/"
const userFile = dataDir + "/user.data"
const friendsFile = dataDir + "/friends.data"
const downloadsDir = app.getPath("downloads") + "/"
const registryFile = "/registry.json"
const registriesDir = globalDir + "/registries/"
const localConfigFile = path.join(defaultDir, "/config.json")

function loadLocalConfig(){
    const config = {
		serverUrl: "https://friendlyfire.sketch-company.de",
		downloadDir: downloadsDir,
		pollInterval: 30
	}
    if(fs.existsSync(localConfigFile)){
		const localConfig = JSON.parse(fs.readFileSync(localConfigFile, "utf8"))
		config.serverUrl = localConfig.serverUrl || "https://friendlyfire.sketch-company.de"
		config.downloadDir = localConfig.downloadDir || downloadsDir
		config.pollInterval = localConfig.pollInterval || 30

		if (!/\S/.test(config.downloadDir)) {
			if (!fs.existsSync(config.downloadDir)) fs.mkdirSync(config.downloadDir, { recursive: true })
		} 
        else config.downloadDir = downloadsDir

		if (config.pollInterval < 1 || config.pollInterval > 15 * 60) config.pollInterval = 30
		console.log("loadLocalConfig: loaded localConfig from", localConfigFile)
	} 
    else{
		console.log("loadLocalConfig: cannot find localConfig file at", localConfigFile)

		fs.writeFileSync(localConfigFile, JSON.stringify(config, null, 3))
	}
	console.log("loadLocalConfig:", JSON.stringify(config, null, 3))
    return config
}

module.exports = {
	globalDir,
	defaultDir,
	dataDir,
	userFile,
	friendsFile,
	registryFile,
	registriesDir,
	downloadsDir,
	loadLocalConfig,
}