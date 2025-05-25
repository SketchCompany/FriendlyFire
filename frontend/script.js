const socket = io()
$(".login").click(openLoginDialog)
$(".download-folder").click(openDownloadFolder)
$(".add-friend").click(openAddFriendDialog)
$(".file-select").click(openFileSelectDialog)
$(".submit").click(sendFile)
$(".tab1-label").click(openTab1)
$(".tab2-label").click(openTab2)
$(".update-files").click(updateFiles)
updateFriendsList()
updateFiles()

function openTab1(){
    $(".tab1").css("display", "flex")
    $(".tab2").css("display", "none")
    $(".tab1-label").addClass("active")
    $(".tab2-label").removeClass("active")
}

function openTab2() {
	$(".tab1").css("display", "none")
	$(".tab2").css("display", "flex")
    $(".tab1-label").removeClass("active")
	$(".tab2-label").addClass("active")
}

function openLoginDialog(){
    socket.on("f:logged-in", (name) => {
        $(".login p").html(name)
    })

    socket.emit("b:login-through-browser")
    console.log("b:login-through-browser")
}

function openDownloadFolder(){
    socket.emit("b:open-download-folder")
    console.log("b:open-download-folder")
}

function openFileSelectDialog(){
    socket.emit("b:open-file-selection")
    console.log("b:open-file-selection")
}

function openAddFriendDialog(){
    const dialog = createDialog("Freund hinzufügen", "Füge einen Freund hinzu dem du Datein schicken möchtest.", `
        <div class="crow">
            <p>Name des Freundes:</p>
            <input id="friendName" style="width: 50%" type="text" placeholder="MeinFreund132">
        </div>
        <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <button id="addFriend" class="marked"><span class="bi bi-plus-circle"></span> Freund hinzufügen</button> 
            <button id="cancelAddFriend"><span class="bi bi-x-circle"></span> Abbrechen</button>
        </div>
    `)

    $("#addFriend").click(function(){
        const friendName = $("#friendName").val()
        addFriend(friendName)
    })

    $("#cancelAddFriend").click(function(){
        removeDialog(dialog)
    })

    socket.on("f:friend-added", (friendName, friends) => {
		notify("Freund hinzugefügt", friendName + " ist jetzt dein Freund. Du kannst ihm jetzt Dateien senden.", "success")
		removeDialog(dialog)
        updateFriendsList()
	})

	socket.on("f:friend-added-failed", (err) => {
        console.error(err)
		notify("Freund hinzufügen fehlgeschlagen", err, "error")
        removeDialog(dialog)
	})
}

function addFriend(friendName){
    socket.emit("b:add-friend", friendName)
}

function updateFriendsList(){
    const friendsListElement = $(".friends")
    friendsListElement.empty()

    socket.emit("b:get-friends", (friends) => {
        friends.forEach((element, index) => {
            addFriendsListElement(element, index)
        })
    })

    console.log("updated friends list")
}

function addFriendsListElement(friend, index){
    const element = $(`
        <div name="${friend.user}" id="${friend.id}" index="${index}" class="friend button">
            <span class="bi bi-person-circle"></span> <p>${friend.user}</p>
        </div>
    `)
    element.click(function(){
        setTabView(friend, element)
        socket.emit("b:set-receiver", friend.id)
    })
    if(index == 0){
        setTabView(friend, element)
        socket.emit("b:set-receiver", friend.id)
    }
    $(".friends").append(element)
}

function setTabView(friend, element){
    $(".tab-friend-name").html("> " + friend.user)
    $(".friends").find(".active").removeClass("active")
    element.addClass("active")
}

function setFilePath(path){
    $(".tab-file-path").html(path)
}

socket.on("f:open-file", (file) => {
    setFilePath(file)
})

function sendFile(){
    socket.emit("b:send-file")
}

socket.on("f:file-sent", (file) => {
    notify("Datei gesendet", "Datei wurde erfolgreich gesendet.", "success")
})

socket.on("f:file-sent-failed", (err) => {
    console.error(err)
	notify("Datei senden fehlgeschlagen", err, "error")
})

socket.on("f:upload-progress-changed", (progress, bytesLoaded, totalBytes, finished) => {
    $(".upload-progress").css("display", "block")
    $(".upload-progress .cprogress").css("width", progress + "%")
    $(".upload-progress .info .upload-progress-bytes").html(`${Math.round(bytesLoaded / 1000000)} MB / ${Math.round(totalBytes / 1000000)} MB`)
    $(".upload-progress .info .upload-progress-percent").html(`${progress}%`)
    if(finished){
        setTimeout(function(){
            $(".upload-progress .cprogress").css("width", "0%")
            $(".upload-progress").css("display", "none")
        }, 1000)
    }
})

socket.on("f:download-progress-changed", (progress, bytesLoaded, totalBytes, finished) => {
    $(".download-progress").css("display", "block")
    $(".download-progress .cprogress").css("width", progress + "%")
    $(".download-progress .info .download-progress-bytes").html(`${Math.round(bytesLoaded / 1000000)} MB / ${Math.round(totalBytes / 1000000)} MB`)
    $(".download-progress .info .download-progress-percent").html(`${progress}%`)
    if(finished){
        setTimeout(function(){
            $(".download-progress .cprogress").css("width", "0%")
            $(".download-progress").css("display", "none")
        }, 1000)
    }
})

socket.on("f:file-downloaded", (file) => {
	notify(file.name.substring(0, 15) + "... heruntergeladen", "Die Datei " + file.name + " wurde erfolgreich von " + file.sender + " heruntergeladen.", "success")
})
socket.on("f:file-downloaded-failed", (err) => {
	console.error(err)
	notify("Herunterladen fehlgeschlagen", "Die Datei konnte nicht heruntergeladen werden: " + JSON.stringify(err), "error")
})

function updateFiles(){
    socket.emit("b:update-files")
}

// socket.on("f:registry-pulled", (files) => {
// 	updateRegistryView(files)
// })
// socket.on("f:registry-pulled-failed", (err) => {
//     console.error(err)
//     notify("Aktuallisieren fehlgeschlagen", err, "error")
// })

socket.on("f:set-files-to-download", (files, filesToDownload) => {
    updateRegistryView(files, filesToDownload)
})

function updateRegistryView(files, filesToDownload){
    if(!filesToDownload) filesToDownload = []
    console.log("files", files)
    $(".files").empty()
    files.forEach((element, index) => {
        addRegistryViewElement(element, index, filesToDownload.includes(element.name))
    })
}
function addRegistryViewElement(file, index, isNew){
    const element = $(`
        <div name="${file.name}" index="${index}" class="button">
            <span class="info">
                <span class="bi bi-file-earmark-text"></span>
                <p>${file.name}</p>
            </span>
            <span class="bi bi-cloud-download"></span>
        </div>
    `)
    if(isNew) element.addClass("new")
    
    element.click(function(){
        socket.emit("b:download-file", file)
    })
    $(".files").append(element)
}