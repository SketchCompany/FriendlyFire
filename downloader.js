const fs = require('fs')
const path = require("path")
const http = require("http")
const https = require("https")
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
		// this.loop = setInterval(async () => {
		// 	await this.update()
		// }, (this.pollInterval || 30) * 1000)

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
                this.emit("filesToDownloadChanged", [], [])
                return
            }
            const checkedFiles = await this.checkFiles(registry.data.files)
            if(!checkedFiles.success){
                this.emit("filesToDownloadChanged", [], [])
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
            let lastLoaded = 0
            let startTime = Date.now()

			console.log("downloader: download: starting download for", file.name)

			// Prepare POST data
			const postData = JSON.stringify({ file: { name: file.name, location: file.location } })
			const urlObj = new URL("/download/file", localConfig.serverUrl)
			const isHttps = urlObj.protocol === "https:"
			const options = {
				hostname: urlObj.hostname,
				port: urlObj.port || (isHttps ? 443 : 80),
				path: urlObj.pathname + urlObj.search,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(postData),
				},
			}

			const reqModule = isHttps ? https : http
			const req = reqModule.request(options, (res) => {
				if (res.statusCode !== 200) {
					let errorData = ""
					res.on("data", (chunk) => (errorData += chunk))
					res.on("end", () => {
						console.error("downloader: download: server error", errorData)
						cb({
							success: false,
							data: errorData,
						})
					})
					return
				}

				const total = parseInt(res.headers["content-length"] || "0", 10)
				let loaded = 0
				const output = localConfig.downloadDir + file.name
				const writer = fs.createWriteStream(output)

				res.on("data", (chunk) => {
					loaded += chunk.length
					const percentCompleted = total ? Math.round((loaded * 100) / total) : 0
                    const durationSeconds = (Date.now() - startTime) / 1000
                    const speed = loaded / durationSeconds

					if (!progressBar && total) {
						progressBar = new ProgressBar("downloader: download: downloading [:bar] :percent :etas", {
							width: 40,
							complete: "=",
							incomplete: " ",
							renderThrottle: 100,
							total: total,
						})
					}
					if (progressBar) {
						progressBar.tick(loaded - lastLoaded)
					}
					lastLoaded = loaded

					if (total) {
						if (percentCompleted >= 100) {
							socket.emit("f:download-progress-changed", 100, 0, 0, 0, true)
						} else {
							socket.emit("f:download-progress-changed", percentCompleted, speed, loaded, total, false)
						}
					}
				})

				res.pipe(writer)

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
			})

			req.on("error", (err) => {
				console.error("downloader: download: request error", err)
				cb({
					success: false,
					data: err,
				})
			})

			req.write(postData)
			req.end()
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

                
                func.send(localConfig.serverUrl + "/download/registry", { user1ID, user2ID: this.receiver }, true).then(async res => {
                    if(res.status == 1){
                        if(!func.exists(config.registriesDir + this.receiver)) await func.mkDir(config.registriesDir + this.receiver)
                        
                        await func.write(config.registriesDir + this.receiver + config.registryFile, func.encrypt(JSON.stringify(res.data, null, 3)))
                        cache.set(this.receiver, res.data)
                        console.log("downloader: pullRegistry: cached response for", this.receiver, "and wrote to file at", config.registriesDir + this.receiver + config.registryFile)
                        cb({
                            success: true,
                            data: res.data
                        })
                    }
                    else{
                        console.error("downloader: pullRegistry: error on server side", res)
                        cb({
                            success: false,
                            data: res,
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