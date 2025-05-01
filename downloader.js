const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');

const globalDir = path.parse(app.getPath("appData")).dir + "/Roaming/Friendly Fire/"
const downloadsDir = path.parse(app.getPath("downloads")).dir

class Downloader {
    constructor() {
        if(fs.existsSync(__dirname + "/config.json")){
            const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
            this.serverUrl = config.serverUrl || "https://friendlyfire.sketch-company.de"
            this.downloadDir = config.downloadDir || downloadsDir
            this.pollInterval = config.pollInterval || 30
            if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true })
            if(this.pollInterval < 1 || this.pollInterval > 15 * 60) this.pollInterval = 30
        }
        else{
            this.serverUrl = "https://friendlyfire.sketch-company.de"
            this.downloadDir = downloadsDir
            this.pollInterval = 30
            fs.writeFileSync(__dirname + "/config.json", JSON.stringify({serverUrl: this.serverUrl, downloadDir: this.downloadDir, pollInterval: this.pollInterval}))
        }
    }

    async start() {
        setInterval(() => this.checkForFiles(), this.pollInterval * 1000)
        this.checkForFiles()
    }

    async checkForFiles() {
        try {
            const res = await axios.get(`${this.serverUrl}/files`)
            const remoteFiles = res.data
            const localFiles = fs.readdirSync(this.downloadDir)

            for (const file of remoteFiles) {
                if (!localFiles.includes(file)) {
                    console.log(`Downloading ${file}...`)
                    const fileRes = await axios.get(`${this.serverUrl}/download/${encodeURIComponent(file)}`, {
                        responseType: 'stream'
                    })
                    const destPath = path.join(this.downloadDir, file)
                    const writer = fs.createWriteStream(destPath)
                    fileRes.data.pipe(writer)
                }
            }
        } catch (err) {
            console.error('Fehler beim Prüfen/Download:', err.message)
        }
    }
}

module.exports = Downloader