const {app} = require("electron")
const path = require("path")

const globalDir = app.getPath("userData") + "/"
const defaultDir = app.isPackaged ? path.parse(app.getPath("exe")).dir + "/" : __dirname + "/"

module.exports = {
    globalDir,
    defaultDir
}