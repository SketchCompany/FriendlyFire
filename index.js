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

const { app, BrowserWindow, Tray, Menu, dialog, autoUpdater, Notification } = require('electron')
let mainWindow
require("./autolaunch.js")
const { Worker } = require("worker_threads")
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
            if(url && url.startsWith("friendlyfireprotocol://")){
                const { token, user } = await func.saveTokenFromUrl(url)
				if (token) {
					if (mainWindow) mainWindow.loadURL("/")

					eventEmitter.emit("loggedIn", user)
					console.log("second-instance: loggedIn:", user)
				} else console.error("parsing url and getting token 't' from", url, "failed")
            }
            else if(url && url != "." && func.isPathValid(url) && func.exists(url)){
                uploader.setFile(url)
                eventEmitter.emit("uploadFileChanged", url)
            }
            else{
                console.log("second-instance: url is neither a login url or a file", url)
            }
        }
    
        if(mainWindow){
            if (!mainWindow.isVisible()) {
                mainWindow.show()
                mainWindow.focus()
			} else if (mainWindow.isMinimized()) {
				mainWindow.restore()
				mainWindow.focus()
			} 
        }
    })
}
app.on("open-url", async (event, url) => {
	event.preventDefault()
	console.log("program called by url", url)

    if(url && url.startsWith("friendlyfireprotocol://")){
        const { token, user } = await func.saveTokenFromUrl(url)
        if (token) {
            if (mainWindow) mainWindow.loadURL("/")

            eventEmitter.emit("loggedIn", user)
            console.log("open-url: loggedIn:", user)
        } else console.error("parsing url and getting token 't' from", url, "failed")
    }
    else if(url && url != "." && func.isPathValid(url) && func.exists(url)){
        uploader.setFile(url)
        eventEmitter.emit("uploadFileChanged", url)
    }
    else{
        console.log("open-url: url is neither a login url or a file", url)
    }

    // const {token, user} = await func.saveTokenFromUrl(url)
    // if(token){
    //     if(mainWindow) mainWindow.loadURL("/")

    //     eventEmitter.emit("loggedIn", user)
    //     console.log("open-url: loggedIn:", user)
    // }
    // else console.error("parsing url and getting token 't' from", url, "failed")

    if (mainWindow) {
		if (!mainWindow.isVisible()) {
			mainWindow.show()
			mainWindow.focus()
		} else if (mainWindow.isMinimized()) {
			mainWindow.restore()
			mainWindow.focus()
		}
	}
})

let startedWithFire = null
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

    if(startedWithFire){
        socket.emit("f:file-set", startedWithFire)
        console.log("io connection: startedWithFire:", startedWithFire)
    }

    eventEmitter.on("uploadFileChanged", (file) => {
        socket.emit("f:file-set", file)
    })

    eventEmitter.on("newFiles", (files, newFiles) => {
        socket.emit("f:set-files-to-download", files, newFiles)
    })

    downloader.on("filesToDownloadChanged", (files, filesToDownload) => {
		socket.emit("f:set-files-to-download", files, filesToDownload)
	})

    socket.on("b:update-files", async (arg) => {
        await downloader.update()
    })

    eventEmitter.on("downloadFile", async (file) => {
        const download = await downloader.download(socket, file)
        if(download.success){
            socket.emit("f:file-downloaded", download.data)
        }
        else socket.emit("f:file-downloaded-failed", download.data)
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

        if (mainWindow) {
			if (!mainWindow.isVisible()) {
				mainWindow.show()
				mainWindow.focus()
			} else if (mainWindow.isMinimized()) {
				mainWindow.restore()
				mainWindow.focus()
			}
		}
	}
    else if(fileToSend && fileToSend != "." && func.isPathValid(fileToSend) && func.exists(fileToSend)){
        console.log("whenReady: fileToSend is a valid file")
        uploader.setFile(fileToSend)
        startedWithFire = fileToSend
        eventEmitter.emit("uploadFileChanged", fileToSend)
    }


    tray = new Tray(path.join(__dirname, "app.png"))
    const contextMenu = Menu.buildFromTemplate([
        { label: "Öffnen", click: () => mainWindow.show()},
        { label: "Beenden", click: () => {
            app.quit()
            app.exit()
        }}
    ])
    tray.setToolTip("Friendly Fire")
    tray.setContextMenu(contextMenu)

    tray.on("click", () => {
        mainWindow.focus()
    })

    tray.on("double-click", () => {
        mainWindow.show()
        mainWindow.focus()
    })

    await createWindow()
    !app.isPackaged && mainWindow.isVisible() ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")

    const worker = new Worker(path.join(__dirname, "background-worker.js"))

    worker.on("error", (err) => {
        console.error("background: worker error:", err)
    })

    worker.on("exit", (code) => {
        console.log("background: worker exited with code", code)
    })

    worker.postMessage({ action: "start", data: {} })
    worker.postMessage({ action: "settings", data: { globalDir: config.globalDir, defaultDir: config.defaultDir, downloadsDir: config.downloadsDir } })

    // from worker to here
    worker.on("message", async (msg) => {
        switch (msg.action) {

            case "set":
                console.log("background-worker: worker: settings set")
                break

            case "checked":
                console.log("background-worker: worker: checked: data:", msg.data)
                if(!msg.success){
                    console.log("background-worker: worker: unsuccessful:", msg.data)
                    break
                }
                if(!msg.data.newFiles){
                    console.log("background-worker: worker: newFiles:", msg.data.newFiles)
                    break
                }
                if(!msg.data.newFiles.length > 0){
                    console.log("background-worker: worker: newFiles:", msg.data.newFiles)
                    break
                }

                console.log("background-worker: worker: found newFiles", msg.data.newFiles)
                eventEmitter.emit("newFiles", msg.data.files, msg.data.newFiles)
                const friends = JSON.parse(func.decrypt(await func.read(config.friendsFile))).friends
                const friend = friends.find((friend) => friend.id == msg.data.receiver)
                
                let notification
                const title = "FriendlyFire"
                const subtitle = "Datei erhalten"
                const icon = path.join(__dirname, "app.png")
                let actions = [
                    { type: "button", text: "Herunterladen" },
                    { type: "button", text: "Ansehen" },
                ]
                const closeButtonText = "Schließen"

                if(process.platform == "win32"){
                    actions = [
						{ type: "button", text: "Herunterladen" },
					]
                }
                else if(process.platform == "linux") actions = []

                if (friend){
                    notification = new Notification({ 
                        title, 
                        icon,
                        subtitle, 
                        body: friend.user + " hat dir " + msg.data.newFiles[0].name + " gesendet.",
                        actions,
                        closeButtonText,
                    })
                }
                else {
                    notification = new Notification({
						title,
						icon,
						subtitle,
						body: "Du hast " + msg.data.newFiles[0].name + " gesendet bekommen.",
						actions,
						closeButtonText,
					})
                }

                notification.on("action", (event, index) => {
                    if (index == 0) {
                        if (mainWindow && !mainWindow.isVisible()) {
							mainWindow.show()
							mainWindow.focus()
						}
                    } else if (index == 1) {
                        if (mainWindow && !mainWindow.isVisible()) {
							mainWindow.show()
							mainWindow.focus()
						}
                        eventEmitter.emit("downloadFile", msg.data.newFiles[0])
                    }
                })

                notification.on("failed", (event, error) => {
                    console.log("background-worker: notification failed:", error)
                })

                notification.on("click", (event) => {
                    if(mainWindow && !mainWindow.isVisible()){
                        mainWindow.show()
						mainWindow.focus()
                    }
                })

                notification.show()
                break

            case "started":
                console.log("bacgkround-worker: worker: started")
                break

            default:
                console.log("background-worker: worker: default break")
                break
        }
    })

    setInterval(function(){
        if(downloader.receiver) worker.postMessage({action: "check", data: {receiver: downloader.receiver}})
    }, (localConfig.pollInterval || 30) * 1000)
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
		maximizable: false,
		show: false,
	})

    mainWindow.loadURL("http://localhost:" + port)

    mainWindow.on("close", (event) => {
        event.preventDefault()
        !app.isPackaged ? mainWindow.webContents.closeDevTools() : console.log("createWindow: blocked dev tools from closing")
        mainWindow.hide()
    })

    mainWindow.on("focus", () => {
        !app.isPackaged ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")
	})
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if(process.platform !== "darwin") {
        e.preventDefault()
    }
})

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if(BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})