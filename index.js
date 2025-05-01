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

const { app, BrowserWindow, Tray, Menu, dialog, autoUpdater } = require('electron');
const path = require('path');
const Downloader = require('./downloader');

let tray = null;

app.whenReady().then(() => {
    const fileToSend = process.argv[1]

    // Hintergrundprozess starten
    const downloader = new Downloader()
    downloader.start()

    // Optional: Tray Icon
    tray = new Tray(path.join(config.defaultDir, "app.ico"))
    const contextMenu = Menu.buildFromTemplate([
        { label: "Beenden", click: () => app.quit() }
    ])
    tray.setToolTip("Friendly Fire")
    tray.setContextMenu(contextMenu)

    // Wenn du ein UI willst, kannst du hier ein Fenster öffnen:
    createWindow()
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit()
}

const createWindow = async () => {
    // check for updates and react with a message if there is an update available
    autoUpdater.on("update-available", async function(){
        dialog.showMessageBox({title: "Update Available", message: "There is an Update for the app available. It is currently being downloaded, please do not close the launcher until you are asked to restart it.", type: "info"})
    })
    require("update-electron-app").updateElectronApp({updateInterval: "5 minutes"})
    
    // Create the browser window.
    const mainWindow = new BrowserWindow({
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
            symbolColor: "rgb(255, 50, 0)",
            height: 25,
        },
        center: true,
        backgroundColor: "rgb(10,10,15)",
        backgroundMaterial: "acrylic",
        darkTheme: true,
    })

    mainWindow.loadFile("./frontend/index.html")

    // Open the DevTools.
    !app.isPackaged ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")
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
