const {app} = require("electron")
const path = require("path")

const globalDir = path.parse(app.getPath("appData")).dir + "/Roaming/Friendly Fire/"
const defaultDir = app.isPackaged ? path.parse(app.getPath("exe")).dir + "/" : __dirname + "/"

module.exports = {
    globalDir,
    defaultDir
}