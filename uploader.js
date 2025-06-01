const fs = require("fs")
const path = require("path")
const http = require("http")
const https = require("https")
const FormData = require("form-data")
const { app, BrowserWindow, Tray, Menu, dialog } = require("electron")
const config = require("./config")
const func = require("./functions.js")
const localConfig = config.loadLocalConfig()
const url = require("url")

class Uploader{
    constructor(file, receiver){
        if(file && file != "." && func.isPathValid(file) && fs.statSync(file).isFile() && fs.existsSync(file)){
            console.log("uploader: constructor: registered file to upload", file)
            this.file = file
        }
        else{
            console.warn("uploader: constructor: no file arg was passed")
        }

        if(receiver && receiver.startsWith("rec")){
            this.receiver = receiver
            console.log("uploader: constructor: valid receiver was passed and registered", receiver)
        }
        else if(receiver){
            console.error("uploader: constructor: invalid receiver was passed", receiver)
        }
        else console.error("uploader: constructor: no receiver set", receiver)
    }

    start(socket){
        return new Promise(async cb => {
            try{
                if(this.file && this.receiver && socket){
                    const formData = new FormData()

                    if(func.exists(config.userFile)){
                        const rawUserFile = await func.read(config.userFile)
                        const decryptedJSON = func.decrypt(rawUserFile)
                        const token = JSON.parse(decryptedJSON).token
                        const user1ID = await func.authenticate(token)
                        console.log("uploader: user1ID", user1ID)
                        if(user1ID){
                            formData.append("user1ID", user1ID)
                        }
                        else{
                            console.error("uploader: start: token is not valid")
                            cb({
                                success: false,
                                data: "start: token is not valid",
                            })
                            return
                        }
                    }
                    else{
                        console.error("uploader: start: userFile at", config.userFile, "does not exist so users is not logged in")
                        cb({
                            success: false,
                            data: "userFile at" + config.userFile + "does not exist so users is not logged in"
                        })
                        return
                    }

                    console.log("uploader: start: user2ID", this.receiver)
                    formData.append("user2ID", this.receiver)
                    formData.append("file", fs.createReadStream(this.file))
                    console.log("uploader: start: file", this.file)

                    // Parse the server URL
                    const uploadUrl = new URL("/upload", localConfig.serverUrl)
					const isHttps = uploadUrl.protocol === "https:"
					const options = {
						method: "POST",
						hostname: uploadUrl.hostname,
						port: uploadUrl.port || (isHttps ? 443 : 80),
						path: uploadUrl.pathname + uploadUrl.search,
						headers: formData.getHeaders(),
					}

                    // Get total length for progress calculation
                    formData.getLength((err, length) => {
                        if (err) {
                            console.error("uploader: start: error getting form length", err)
                            cb({ success: false, data: err })
                            return
                        }
                        options.headers['Content-Length'] = length

                        const req = (isHttps ? https : http).request(options, res => {
                            let responseData = ""
                            res.on("data", chunk => {
                                responseData += chunk
                            })
                            res.on("end", () => {
                                let data
                                try {
                                    data = JSON.parse(responseData)
                                } catch (e) {
                                    data = responseData
                                }
                                if (res.statusCode >= 200 && res.statusCode < 300) {
                                    console.log("uploader: start: file upload successful on client with response", data)
                                    cb({
                                        success: true,
                                        data
                                    })
                                } else {
                                    console.error("uploader: start: upload failed", data)
                                    cb({
                                        success: false,
                                        data
                                    })
                                }
                            })
                        })

                        req.on("error", err => {
                            console.error("uploader: start: catched error", err)
                            cb({
                                success: false,
                                data: err
                            })
                        })

                        // Track progress
                        let uploaded = 0
                        let startTime = Date.now()
                        formData.on("data", chunk => {
                            uploaded += chunk.length
                            const percentCompleted = Math.round((uploaded * 100) / length)
                            const durationSeconds = (Date.now() - startTime) / 1000
                            const speed = uploaded / durationSeconds

                            console.log(`uploader: uploaded bytes: ${uploaded} / ${length}`)
                            console.log(`uploader: uploaded: ${percentCompleted}%`)
                            if (percentCompleted >= 100) {
                                socket.emit("f:upload-progress-changed", 100, 0, 0, 0, true)
                            } else {
                                socket.emit("f:upload-progress-changed", percentCompleted, speed, uploaded, length, false)
                            }
                        })

                        // Pipe form data to request
                        formData.pipe(req)
                    })
                }
                else{
                    console.error("uploader: start: socket, file or receiver was not set")
                    console.error("uploader: socket", socket && socket.id)
                    console.error("uploader: file", this.file)
                    console.error("uploader: receivers", this.receiver)
                    cb({
                        success: false,
                        data: "socket, file or receiver was not set",
                    })
                }
            }
            catch(err){
                console.error("uploader: start:", err)
                cb({
                    success: false,
                    data: err
                })
            }
        })
    }

    setFile(file){
        if(file && file != "." && func.isPathValid(file) && fs.statSync(file).isFile() && func.exists(file)){
            console.log("uploader: constructor: registered file to upload", file)
            this.file = file
        }
        else{
            console.warn("uploader: constructor: no file arg was passed")
        }
    }

    setReceiver(receiver){
        if(receiver.startsWith("rec")){
            this.receiver = receiver
            console.log("uploader: constructor: valid receiver was passed and registered", receiver)
        }
        else if(receiver){
            console.error("uploader: constructor: invalid receiver was passed", receiver)
        }
        else console.error("uploader: constructor: no receiver set", receiver)
    }
}
module.exports = Uploader