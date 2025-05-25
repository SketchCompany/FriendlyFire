const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron')
const config = require("./config")
const func = require("./functions")
const EventEmitter = require("events")
const ProgressBar = require("progress")
const NodeCache = require('node-cache')
const cache = new NodeCache({checkperiod: 15, deleteOnExpire: true, stdTTL: 15})
const localConfig = config.loadLocalConfig()

class Downloader extends EventEmitter{
    constructor(receiver){
        super()
        this.setMaxListeners(11)
        this.serverUrl = localConfig.serverUrl
        this.downloadDir = localConfig.downloadDir
        this.pollInterval = localConfig.pollInterval
        this.checkIfReceiverIsValidAndSet(receiver)
    }

    checkIfReceiverIsValidAndSet(receiver){
        if(receiver && receiver.startsWith("rec")){
            this.receiver = receiver
            console.log("downloader: checkIfReceiverIsValidAndSet: valid receiver was passed and registered", receiver)
        }
        else if(receiver){
            console.error("downloader: checkIfReceiverIsValidAndSet: invalid receiver was passed", receiver)
        }
        else console.error("downloader: checkIfReceiverIsValidAndSet: no receiver set", receiver)
    }

    isRunning = false
    loop = null

    async start(){
        if(!this.receiver){
            console.log("downloader: start: canceled start, because receiver is not set")
            return
        }

        if(this.isRunning) return
        this.isRunning = true
        console.log("downloader: start: downloader started")
		this.loop = setInterval(async () => {
			await this.update()
		}, this.pollInterval * 1000)

        await this.update()
    }

    stop(){
        clearInterval(this.loop)
        this.isRunning = false
    }

    update(){
        return new Promise(async cb => {
            const registry = await this.pullRegistry()
            if(!registry.success){
                cb()
                return
            }
            const checkedFiles = await this.checkFiles(registry.data.files)
            if(!checkedFiles.success){
                cb()
                return
            }
            this.emit("filesToDownloadChanged", registry.data.files, checkedFiles.data.filesToDownload)
            cb()
            return
        })
    }

    checkFiles(files){
        return new Promise(async cb => {
            try{
                const localFiles = await func.readDir(localConfig.downloadDir)
                const relatedFiles = localFiles.filter(localFile => files.find(file => file.name == localFile))
                const oldFiles = relatedFiles.filter(localRelatedFile => fs.statSync(localConfig.downloadDir + localRelatedFile).size != this.getLatestFileVersion(files, localRelatedFile).size)
                const sameFiles = relatedFiles.filter(localRelatedFile => fs.statSync(localConfig.downloadDir + localRelatedFile).size == this.getLatestFileVersion(files, localRelatedFile).size)
                const newFiles = files.filter(file => !relatedFiles.includes(file.name))
                if(oldFiles.length > 0) console.log("downloader: checkFiles: found oldFiles in", localConfig.downloadDir, oldFiles)
                else console.log("downloader: checkFiles: no oldFiles found", oldFiles)
                const filesToDownload = newFiles
                for (let i = 0; i < oldFiles.length; i++) {
                    const element = oldFiles[i];
                    const latestFileVersion = this.getLatestFileVersion(files, element)
                    filesToDownload.push(latestFileVersion)
                }
                console.log("downloader: checkFiles: files to download", filesToDownload)
                cb({
					success: true,
					data: { filesToDownload, oldFiles, sameFiles },
				})
            }
            catch(err){
                console.error("downloader: checkFiles:", err)
                cb({
                    success: false,
                    data: err
                })
            }
        })
    }

    getLatestFileVersion(files, localRelatedFile){
        const relevantFiles = files.filter(relevant => relevant.name == localRelatedFile)
        let latestFileIndex
        let largestFileSize = 0
        for (let i = 0; i < relevantFiles.length; i++) {
            const element = relevantFiles[i];
            if(element.size > largestFileSize){
                largestFileSize = element.size
                latestFileIndex = i
            }
        }
        return files[latestFileIndex]
    }

    download(socket, file){
        return new Promise(async cb => {
            if(!socket){
                console.error("downloader: download: socket was not set", socket)
                cb({
                    success: false,
                    data: "download: socket was not set"
                })
            }
            if(!file && !/\S/.test(file)){
                console.error("downloader: download: file was not set", file)
                cb({
					success: false,
					data: "download: file was not set",
				})
            }
            console.log("downloader: download: file", file)
    
            let progressBar = null
    
            console.log("downloader: download: staring download for", file.name)
    
            let lastLoaded = 0
            axios.post(localConfig.serverUrl + "/download/file", {file: {name: file.name, location: file.location}}, {responseType: "stream", onDownloadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                console.log(`downloader: download bytes: ${progressEvent.loaded} / ${progressEvent.total}`)
                console.log(`downloader: download: ${percentCompleted}%`)
                            
                if(percentCompleted >= 100){
                    socket.emit("f:download-progress-changed", 100, 0, 0, true)
                }
                else{
                    socket.emit("f:download-progress-changed", percentCompleted, parseInt(progressEvent.loaded), parseInt(progressEvent.total), false)
                }
    
                if(!progressBar) progressBar = new ProgressBar("downloader: download: downloading [:bar] :percent :etas", {
					width: 40,
					complete: "=",
					incomplete: " ",
					renderThrottle: 100,
					total: parseInt(progressEvent.total),
				})
                progressBar.tick(progressEvent.loaded - lastLoaded)
                lastLoaded = progressEvent.loaded
            }}).then(response => {
                const output = localConfig.downloadDir + file.name
                const writer = fs.createWriteStream(output)
                response.data.pipe(writer)
    
                writer.on("finish", () => {
                    console.log("downloader: download: download finished at", output)
                    cb({
                        success: true,
                        data: file,
                    })
                })
                writer.on("error", (err) => {
                    console.error("downloader: download: download failed", err)
                    cb({
                        success: false,
                        data: err,
                    })
                })
            }).catch(err => {
                console.error(err)
                cb({
                    success: false,
                    data: err,
                })
            })
        })
    }

    pullRegistry(){
        return new Promise(async cb => {
            try{
                if(!this.receiver){
                    console.error("downloader: pullRegistry: receiver was not set")
                    cb({
                        success: false,
                        data: "pullRegistry: receiver was not set",
                    })
                    return
                }

                if(cache.has(this.receiver)){
                    cb({
                        success: true,
                        data: cache.get(this.receiver),
                    })
                    return
                }

                if(!func.exists(config.userFile)){
                    console.error("downloader: pullRegistry: userFile cannot be found at", config.userFile)
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
                    console.error("downloader: pullRegistry: token is not valid")
					cb({
						success: false,
						data: "pullRegistry: token is not valid",
					})
					return
                }

                axios.post(localConfig.serverUrl + "/download/registry", { user1ID, user2ID: this.receiver }).then(async res => {
                    if(res.data.status == 1){
                        if(!func.exists(config.registriesDir + this.receiver)) await func.mkDir(config.registriesDir + this.receiver)
                        
                        await func.write(config.registriesDir + this.receiver + config.registryFile, func.encrypt(JSON.stringify(res.data.data, null, 3)))
                        cache.set(this.receiver, res.data.data)
                        console.log("downloader: pullRegistry: cached response for", this.receiver, "and wrote to file at", config.registriesDir + this.receiver + config.registryFile)
                        cb({
                            success: true,
                            data: res.data.data
                        })
                    }
                    else{
                        console.error("downloader: pullRegistry: error on server side", res.data)
                        cb({
                            success: false,
                            data: res.data,
                        })
                    }
                }).catch(err => {
                    console.error("downloader: pullRegistry: catched error", err)
                    cb({
                        success: false,
                        data: err,
                    })
                })
            } 
            catch(err){
                console.error("downloader: pullRegistry: error on download", err)
            }
        })
    }

    setReceiver(receiver){
        this.checkIfReceiverIsValidAndSet(receiver)
    }
}

module.exports = Downloader