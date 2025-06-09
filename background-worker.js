const { parentPort } = require("worker_threads")
const func = require("./background-functions.js")
const backgroundConfig = require("./background-config.js")
let config = null
let localConfig = null

parentPort.on("message", async (msg) => {
	switch(msg.action){

        case "settings":
            console.log("background-worker: settings:", msg.data)
            backgroundConfig.setGlobalDir(msg.data.globalDir)
            backgroundConfig.setDefaultDir(msg.data.defaultDir)
            backgroundConfig.setDownloadsDir(msg.data.downloadsDir)
            backgroundConfig.evaluatePaths()
            config = backgroundConfig.getConfig()
            localConfig = backgroundConfig.loadLocalConfig()
            parentPort.postMessage({action: "set", data: {}})
            break

        case "check": 
            try{
                console.log("background-worker: check: data:", msg.data)

                let oldRegistry = []
                if(func.exists(config.registriesDir + msg.data.receiver + config.registryFile)){
                    oldRegistry = JSON.parse(func.decrypt(await func.read(config.registriesDir + msg.data.receiver + config.registryFile))).files
                    console.log("background-worker: found oldRegistry:", oldRegistry)
                }
                
                const response = await pullRegistry(msg.data.receiver)
                if(response.success){
                    const registryFiles = response.data.files
                    const newFiles = registryFiles.filter(file => !oldRegistry.find(oldFile => oldFile.name == file.name)) || []
                    parentPort.postMessage({ action: "checked", success: true, data: {files: registryFiles, newFiles, receiver: msg.data.receiver} })
                }
                else parentPort.postMessage({ action: "checked", success: false, data: response })
            } 
            catch(err){
                parentPort.postMessage({ action: "checked", success: false, data: err })
            }
            break

        case "start":
            parentPort.postMessage({ action: "started", data: {}})
            break

        default:
            console.log("background-worker: worker: default break")
            break
    }
})

function pullRegistry(receiver){
    return new Promise(async cb => {
        try{
            if(!receiver){
                console.error("background-worker pullRegistry: receiver was not set")
                cb({
                    success: false,
                    data: "pullRegistry: receiver was not set",
                })
                return
            }

            if(!func.exists(config.userFile)){
                console.error("background-worker: pullRegistry: userFile cannot be found at", config.userFile)
                cb({
                    success: false,
                    data: "pullRegistry: userFile cannot be found at " + config.userFile,
                })
                return
            }

            const rawUserFile = await func.read(config.userFile)
            const decryptedJSON = func.decrypt(rawUserFile)
            const userData = JSON.parse(decryptedJSON)
            const user1ID = await func.authenticate(userData.token)
            
            if(!user1ID){
                console.error("background-worker: pullRegistry: token is not valid")
                cb({
                    success: false,
                    data: "pullRegistry: token is not valid",
                })
                return
            }

            
            func.send(localConfig.serverUrl + "/download/registry", { user1ID, user2ID: receiver }, true).then(async res => {
                if(res.status == 1){
                    if(!func.exists(config.registriesDir + receiver)) await func.mkDir(config.registriesDir + receiver)
                    
                    await func.write(config.registriesDir + receiver + config.registryFile, func.encrypt(JSON.stringify(res.data, null, 3)))
                    console.log("background-worker: pullRegistry: cached response for", receiver, "into file at", config.registriesDir + receiver + config.registryFile)
                    cb({
                        success: true,
                        data: res.data
                    })
                }
                else{
                    console.error("background-worker: pullRegistry: error on server side", res)
                    cb({
                        success: false,
                        data: res,
                    })
                }
            }).catch(err => {
                console.error("background-worker: pullRegistry: catched error", err)
                cb({
                    success: false,
                    data: err,
                })
            })
        } 
        catch(err){
            console.error("background-worker: pullRegistry: error on download", err)
            cb({
                success: false,
                data: err
            })
        }
    })
}