const config = require("./config")
const log = require("electron-log")
log.transports.file.level = "debug"
log.transports.file.resolvePathFn = (variables) => {
    return path.join(config.defaultDir, "friendlyfire.log")
}
Object.assign(console, log.functions)
process.on("uncaughtException", (error) => {
    console.error("Unhandled Exception:", error)
})

const { app, BrowserWindow, Tray, Menu, dialog, autoUpdater } = require('electron')
let mainWindow
const path = require('path')
const express = require('express')
const { createServer } = require("http")
const { Server } = require("socket.io")
const Downloader = require('./downloader')
const downloader = new Downloader()
const Uploader = require("./uploader")
const uploader = new Uploader()
const func = require('./functions.js')
const serverManager = require("./server.js")
const child_process = require("child_process")
const EventEmitter = require("events")
const eventEmitter = new EventEmitter()
const localConfig = config.loadLocalConfig()

const port = 3000
const expressApp = express()
expressApp.use(express.json())
expressApp.use("/", serverManager)
const server = createServer(expressApp)
server.listen(port, () => {
	console.log("server running at http://localhost:" + port)
})
const io = new Server(server)
let tray = null

app.setAsDefaultProtocolClient("friendlyfireprotocol")
// create only one instance, so if an instance is already running, quit this one, 
// otherwise check for a passed token from the api to save in to a file
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock){
    app.quit()
} 
else{
    app.on("second-instance", async (event, argv, workingDirectory) => {
        const url = argv[2]
        console.log("second-instance: url", url)
        if(process.platform === "win32"){
            const {token, user} = await func.saveTokenFromUrl(url)
            if(token){
                if(mainWindow) mainWindow.loadURL("/")

                eventEmitter.emit("loggedIn", user)
                console.log("second-instance: loggedIn:", user)
            } 
            else console.error("parsing url and getting token 't' from", url, "failed")
        }
    
        if(mainWindow){
            if(mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })
}
app.on("open-url", async (event, url) => {
	event.preventDefault()
	console.log("program called by url", url)

    const {token, user} = await func.saveTokenFromUrl(url)
    if(token){
        if(mainWindow) mainWindow.loadURL("/")

        eventEmitter.emit("loggedIn", user)
        console.log("open-url: loggedIn:", user)
    }
    else console.error("parsing url and getting token 't' from", url, "failed")

    if(mainWindow){
        if(mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
    }
})

io.on("connection", async (socket) => {
    console.log("socket: connected", socket.id)

    if(func.exists(config.userFile)){
        const rawUserFile = await func.read(config.userFile)
        const decryptedJSON = func.decrypt(rawUserFile)
        const data = JSON.parse(decryptedJSON)
        const user1ID = await func.authenticate(data.token)
        if(user1ID){
            socket.emit("f:logged-in", data.user)
        }
        else{
            const open = await import("open")
		    open.default("https://api.sketch-company.de/login?redirect=friendlyfireprotocol://login")
        }
    }

    eventEmitter.on("loggedIn", (name) => {
        console.log("loggedIn: name:", name)
        socket.emit("f:logged-in", name)
    })

    downloader.on("filesToDownloadChanged", (files, filesToDownload) => {
		socket.emit("f:set-files-to-download", files, filesToDownload)
	})

    socket.on("b:update-files", async (arg) => {
        await downloader.update()
    })

    socket.on("b:download-file", async (file) => {
        const download = await downloader.download(socket, file)
        if(download.success){
            socket.emit("f:file-downloaded", download.data)
        }
        else socket.emit("f:file-downloaded-failed", download.data)
    })

    // open login api website in the browser
    socket.on("b:login-through-browser", async (arg) => {
		const open = await import("open")
		open.default("https://api.sketch-company.de/login?redirect=friendlyfireprotocol://login")
	})

    socket.on("b:open-download-folder", async (arg) => {
        const open = await import("open")
        await open.default(localConfig.downloadDir, {wait: false})
    })

    socket.on("b:set-file", (file) => {
        uploader.setFile(file)
    })

    socket.on("b:set-receiver", (receiver) => {
		uploader.setReceiver(receiver)
		downloader.setReceiver(receiver)

        downloader.start()
	})

    socket.on("b:open-file-selection", async (arg) => {
		const response = await dialog.showOpenDialog({ properties: ["openFile"] })
		if(!response.canceled){
			const file = response.filePaths[0]
			uploader.setFile(file)
            socket.emit("f:open-file", file)
		}
        else{
            socket.emit("f:open-file-canceled")
        }
	})

    socket.on("b:get-friends", async (cb) => {
        if(func.exists(config.friendsFile)){
            const rawFriendsFile = await func.read(config.friendsFile)
            const decryptedJSON = func.decrypt(rawFriendsFile)
            console.log(decryptedJSON)
            const friends = JSON.parse(decryptedJSON).friends
			cb(friends)
        }
        else cb([])
    })

    socket.on("b:add-friend", async (friendName) => {
        console.log("add-friend: friendName", friendName)

        if(!func.exists(config.dataDir)) await func.mkDir(config.dataDir)
        
        if(!func.exists(config.friendsFile)){
            const response = await func.send("https://api.sketch-company.de/u/find", {userOrEmail: friendName}, true)
            
            if(response.status == 1){
                const friends = []
				friends.push({
                    id: response.data.id,
                    user: response.data.user
                })
                await func.write(config.friendsFile, func.encrypt(JSON.stringify({friends}, null, 3)))
                console.log("add-friend:", friendName, "successfully added to friends list at", config.friendsFile)
                socket.emit("f:friend-added", response.data.user)
            }
            else{
                console.log("add-friend: error on reqeust", response.data)
                socket.emit("f:friend-added-failed", response.data)
            }
        }
        else{
            const friends = JSON.parse(func.decrypt(await func.read(config.friendsFile))).friends
            if(!friends.find(friend => friend.user == friendName)){
                const response = await func.send("https://api.sketch-company.de/u/find", {userOrEmail: friendName}, true)
                if(response.status == 1){
                    friends.push({
                        id: response.data.id,
                        user: response.data.user
                    })
                    await func.write(config.friendsFile, func.encrypt(JSON.stringify({friends}, null, 3)))
                    console.log("add-friend:", friendName, "successfully added to friends list at", config.friendsFile)
                    socket.emit("f:friend-added", response.data.user)
                }
                else{
                    console.log("add-friend: error on reqeust", response.data)
                    socket.emit("f:friend-added-failed", response.data)
                }
            }
            else{
                await dialog.showMessageBox({title: "Freund ist bereits hinzugefügt", message: "Der angegebene Freund ist bereits in deiner Freundes Liste.", type: "info", defaultId: 0})
            }
        }
    })

    socket.on("b:send-file", async (args) => {
        const response = await uploader.start(socket)

        if(response.success){
            socket.emit("f:file-sent", response)
        }
        else{
            console.error("send-file: failed", response)
            socket.emit("f:file-sent-failed", response)
        }
    })
})

app.whenReady().then(async () => {
    const fileToSend = process.argv[1]
    if(fileToSend) console.log("received fileToSend", fileToSend)
    if(fileToSend && fileToSend.startsWith("friendlyfireprotocol://")){
        console.log("whenReady: fileToSend:", fileToSend)
		const {token, user} = await func.saveTokenFromUrl(fileToSend)
		if(token){
			if(mainWindow) mainWindow.loadURL("/")
            
            eventEmitter.emit("loggedIn", user)
            console.log("whenReady: loggedIn:", user)
        
		} 
        else console.error("parsing url and getting token 't' from", fileToSend, "failed")

		if(mainWindow) {
			if(mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.focus()
		}
	}

    uploader.setFile(fileToSend)

    tray = new Tray(path.join(__dirname, "app.ico"))
    const contextMenu = Menu.buildFromTemplate([
        { label: "Beenden", click: () => app.quit() }
    ])
    tray.setToolTip("Friendly Fire")
    tray.setContextMenu(contextMenu)

    createWindow()
    !app.isPackaged ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit()
}

const createWindow = async () => {
    // check for updates and react with a message if there is an update available
    autoUpdater.on("update-available", async function(){
        dialog.showMessageBox({title: "Update Available", message: "There is an Update for the app available. It's currently being downloaded, please do not close the launcher until you are asked to.", type: "info"})
    })
    require("update-electron-app").updateElectronApp({updateInterval: "5 minutes"})
    
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minHeight: 720,
        minWidth: 1280,
        maxWidth: 1920,
        autoHideMenuBar: true,
        icon: path.join(config.defaultDir, "app.ico"),
        title: "Friendly Fire",
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "rgb(10,10,15)",
            symbolColor: "rgb(255, 75, 0)",
            height: 25,
        },
        center: true,
        backgroundColor: "rgb(10,10,15)",
        darkTheme: true,
        resizable: false,
        fullscreenable: false,
        maximizable: false
    })

    mainWindow.loadURL("http://localhost:" + port)

    // Open the DevTools.
    //!app.isPackaged ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
