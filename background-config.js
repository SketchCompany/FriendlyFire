const fs = require("fs")

let globalDir = "/"
let defaultDir = __dirname + "/"
let dataDir = globalDir + "/data/"
let userFile = dataDir + "/user.data"
let friendsFile = dataDir + "/friends.data"
let registryFile = "/registry.json"
let registriesDir = globalDir + "/registries/"
let downloadsDir = "/"
let localConfigFile = defaultDir + "/config.json"

function setGlobalDir(path){
    globalDir = path
}

function setDefaultDir(path) {
	defaultDir = path
}

function setDownloadsDir(path) {
	downloadsDir = path
}

function evaluatePaths(){
	dataDir = globalDir + "/data/"
	userFile = dataDir + "/user.data"
	friendsFile = dataDir + "/friends.data"
	registriesDir = globalDir + "/registries/"
	localConfigFile = defaultDir + "/config.json"
	// console.log("background-config: evaluatePaths: new paths:", {
	// 	globalDir,
	// 	defaultDir,
	// 	dataDir,
	// 	userFile,
	// 	friendsFile,
	// 	registryFile,
	// 	registriesDir,
	//  localConfigFile,
	// })
}

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
		console.log("background-config: loadLocalConfig: loaded localConfig from", localConfigFile)
	} 
	else{
		console.log("background-config: loadLocalConfig: cannot find localConfig file at", localConfigFile)

		fs.writeFileSync(localConfigFile, JSON.stringify(config, null, 3))
	}
	console.log("background-config: loadLocalConfig:", JSON.stringify(config, null, 3))
	return config
}

function getConfig(){
	return {
		globalDir,
		defaultDir,
		dataDir,
		userFile,
		friendsFile,
		registryFile,
		registriesDir,
		downloadsDir
	}
}

module.exports = {
	setGlobalDir,
	setDefaultDir,
	setDownloadsDir,
	getConfig,
	loadLocalConfig,
	evaluatePaths
}