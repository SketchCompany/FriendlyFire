const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron')
const config = require("./config")

const downloadsDir = path.parse(app.getPath("downloads")).dir + "/"
const localConfigFile = path.join(config.defaultDir, "/config.json")

class Downloader{
    constructor(){
        if(fs.existsSync(localConfigFile)){
            const localConfig = JSON.parse(fs.readFileSync(localConfigFile, 'utf8'))
            this.serverUrl = localConfig.serverUrl || "https://friendlyfire.sketch-company.de"
            this.downloadDir = localConfig.downloadDir || downloadsDir
            this.pollInterval = localConfig.pollInterval || 30

            if(!/\S/.test(this.downloadDir)){
                if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true })
            }
            else this.downloadDir = downloadsDir

            if(this.pollInterval < 1 || this.pollInterval > 15 * 60) this.pollInterval = 30
            console.log("cosntructor: loaded localConfig from", localConfigFile)
        }
        else{
            console.log("constructor: cannot find localConfig file at", localConfigFile)
            this.serverUrl = "https://friendlyfire.sketch-company.de"
            this.downloadDir = downloadsDir
            this.pollInterval = 30
            fs.writeFileSync(localConfigFile, JSON.stringify({
                serverUrl: this.serverUrl, 
                downloadDir: this.downloadDir, 
                pollInterval: this.pollInterval
            }))
        }
        console.log("constructor:", JSON.stringify({
            serverUrl: this.serverUrl, 
            downloadDir: this.downloadDir, 
            pollInterval: this.pollInterval
        }))
    }

    async start(){
        console.log("start: downloader started")
        setInterval(() => this.checkForFiles(), this.pollInterval * 1000)
        this.checkForFiles()
    }

    async checkForFiles(){
        try{
            // const res = await axios.get(`${this.serverUrl}/files`)
            // const remoteFiles = res.data
            // const localFiles = fs.readdirSync(this.downloadDir)

            // for (const file of remoteFiles) {
            //     if(!localFiles.includes(file)) {
            //         console.log(`Downloading ${file}...`)
            //         const fileRes = await axios.get(`${this.serverUrl}/download/${encodeURIComponent(file)}`, {
            //             responseType: 'stream'
            //         })
            //         const destPath = path.join(this.downloadDir, file)
            //         const writer = fs.createWriteStream(destPath)
            //         fileRes.data.pipe(writer)
            //     }
            // }
        } 
        catch(err){
            console.error("checkForFiles: error on download", err)
        }
    }
}

module.exports = Downloader