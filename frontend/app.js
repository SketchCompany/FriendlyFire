
// handle context menus
let clicked
/**
 * 
 * @param {string} name the selector for the context menu, so its open when the element with the same name (selector) got right clicked
 * @param {string} id the id or name of the contextmenu, which is used for removing the contextmenu
 * @param {string} elements the elements in the contextmenu as ``` `` ``` string
 * @param {function} event the callback, which is called when one of the buttons is clicked and provides two paramters: ```i``` (the index of the button of the contextmenu) and ```element``` (the element that was right clicked)
 * @param {Array<string>} blocked the list of blocked elements that cannot trigger the contextmenu
 */
function createCtxMenu(name, id, elements, event, blocked){
	$("body").prepend(`
		<div id="${id}-ctx-menu" class="context-menu" style="display: none;"></div>
	`)
	

    $("#" + id + "-ctx-menu").append(elements)
    $("#" + id + "-ctx-menu").children().last().addClass("lastItem")
    $("#" + id + "-ctx-menu").on("mouseleave", function(e){
        $("#" + id + "-ctx-menu").css("display", "none")
    })
    $("#" + id + "-ctx-menu").on("contextmenu", function(e){
        e.stopPropagation()
    })

    $("#" + id + "-ctx-menu").children().each((i, element) => {
        if($(element).attr("listener")) return
        $(element).attr("listener", "true")
        $(element).click(() => {
            event(i, clicked)
            $("#" + id + "-ctx-menu").css("display", "none")
        })
    })

    $(name).on("contextmenu", function(e){
        e.preventDefault()
        e.stopPropagation()
        if(blocked){
            for (let i = 0; i < blocked.length; i++) {
                const element = blocked[i];
                if(e.target.classList.contains(element)){
                    return
                }
            }
        }

        const {clientX: mouseX, clientY: mouseY} = e

        $("#" + id + "-ctx-menu").css("top", mouseY - 20 + "px")
        $("#" + id + "-ctx-menu").css("left", mouseX - 20 + "px")
        $("#" + id + "-ctx-menu").css("display", "block")
        clicked = e.target
    })
}

// update a context menu by its name and id
/**
 * update a context menu by its name and id and optional provide a list of elements that are blocked
 * @param {string} name the selector for the context menu, so its open when the element with the same name (selector) got right clicked
 * @param {string} id the id or name of the contextmenu, which is used for removing the contextmenu
 * @param {Array<string>} blocked the list of blocked elements that cannot trigger the contextmenu
 */
function updateCtxMenu(name, id, blocked){
    $(name).on("contextmenu", function(e){
        e.preventDefault()
        e.stopPropagation()
        if(blocked){
            for (let i = 0; i < blocked.length; i++) {
                const element = blocked[i];
                if(e.target.classList.contains(element)){
                    return
                }
            }
        }

        const {clientX: mouseX, clientY: mouseY} = e

        $("#" + id + "-ctx-menu").css("top", mouseY - 20 + "px")
        $("#" + id + "-ctx-menu").css("left", mouseX - 20 + "px")
        $("#" + id + "-ctx-menu").css("display", "block")
        clicked = e.target
    })
}

// remove a created context menu by its id
/**
 * remove a created context menu by its id
 * @param {string} id 
 */
function removeCtxMenu(id){
    $("#" + id + "-ctx-menu").remove()
}

// create default context menu
createCtxMenu("html", "default", `
    <button onclick="back()"><span class="bi bi-arrow-left-circle"></span> Zurück</button>
    <button onclick="location.reload()"><span class="bi bi-arrow-clockwise"></span> Neuladen</button>
`, () => {})

// change background color of the header when the user scrolled more than 30px
window.addEventListener("scroll", () => {
    if(window.scrollY > 30){
        $("header").addClass("header-scrolling")
    }
    else if($("header").hasClass("header-scrolling")){
       $("header").removeClass("header-scrolling")
    }
    const menus = $(".context-menu").map(function(){return this}).get()
    if(menus.length > 0){
        menus.forEach(element => {
            element.style.display = "none"
        })
    }
})

// handle the input fields that are used for codes with multiple single input fields
const inputCodes = $(".input-code").map(function(){return this}).get()
for (let i = 0; i < inputCodes.length; i++) {
    const element = $(inputCodes[i]);
    element.children().first().focus()
    element.children().map(function(){return this}).get().forEach((codeInput, index) => {
        $(codeInput).attr("maxlength", "1")
        $(codeInput).keyup(function(e){
            if(e.key == "Backspace"){
                const prev = $(codeInput).prev()
                if(prev.length > 0){
                    prev.focus()
                }
            }
            else{
                const next = $(codeInput).next()
                if(next.length > 0){
                    next.focus()
                }
            }
        })
    })
}

// disable spellcheck and autocomplete attributes for input fields
const inputs = $("input").map(function(){return this}).get()
for (let i = 0; i < inputs.length; i++) {
    const element = $(inputs[i]);
    element.attr("spellcheck", "false")
    element.attr("autocomplete", "off")
}

// input fields with a clickable eye on the right side to view input of password input fields
const inputViewables = $(".input-viewable").map(function(){return this}).get()
for (let i = 0; i < inputViewables.length; i++) {
    const element = $(inputViewables[i]);
    const button = element.children().last()
    const input = element.children().first()
    button.click(function(){
        if(input.attr("type") == "password"){
            button.children().first().removeClass("bi-eye")
            button.children().first().addClass("bi-eye-slash")
            input.attr("type", "text")
        }
        else{
            button.children().first().removeClass("bi-eye-slash")
            button.children().first().addClass("bi-eye")
            input.attr("type", "password")
        }
    })
}

// wait for an element to load before using it
function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// disable scrolling if another element is opened on top like the offcanvas or dialog
/**
 * disable scrolling if another element is opened on top like the offcanvas or dialog
 */
function disableScroll(){
    document.body.classList.add("disabledInput")
}

// enable scrolling if another element is opened on top like the offcanvas or dialog
/**
 * enable scrolling if another element is opened on top like the offcanvas or dialog
 */
function enableScroll(){
    if(document.body.classList.contains("disabledInput")){
        document.body.classList.remove("disabledInput")
    }
}

// open another site
/**
 * open another site
 * @param {string} href the link to the site top open
 * @param {string} target the ```target``` where the site should be opened at
 */
function openSite(href, target){
    if(target) open(href, target)
    else open(href, "_self")
}

// fetch information from the backend with the GET method and return the data of the response
/**
 * fetch information from the backend with the GET method and return the data of the response
 * @param {string} url the url to fetch the data from
 * @param {boolean} raw used to get the complete response
 * @param {boolean} log used to disable the log
 * @returns {Promise<JSON> | Promise<string>}
 */
function get(url){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        cb(result.data)
    })
}

// fetch information from the backend with the GET method and return the complete response
function get(url, raw){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)   
    })
}

// fetch information from the backend with the GET method and return the complete response and cache
function getAndCache(url, raw){
    return new Promise(async cb => {
        const response = await fetch("/api/request-and-cache?url=" + url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)   
    })
}

// // fetch information from the backend with the GET method and return the complete response but only log it when "log" was set to true
// function get(url, raw, log){
//     return new Promise(async cb => {
//         const response = await fetch(url)
//         const result = await response.json()
//         if(log) console.log("get:", url, "response:", result)
//         if(raw) cb(result)
//         else cb(result.data)   
//     })
// }

// fetch information from or to the backend with the POST method and return the data of the response
/**
 * fetch information from or to the backend with the POST method and return the data of the response
 * @param {string} url the url to fetch the data from
 * @param {boolean} raw used to get the complete response
 * @param {boolean} log used to disable the log
 * @returns {Promise<JSON> | Promise<string>}
 */
function send(url, data){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        console.log("send:", url, "response:", result)
        cb(result.data)
    })
}

// fetch information from or to the backend with the POST method and return the complete response
function send(url, data, raw){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        console.log("send:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)
    })
}

// // fetch information from or to the backend with the POST method and return the complete response but only log it when "log" was set to true
// function send(url, data, raw, log){
//     return new Promise(async cb => {
//         const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
//         const result = await response.json()
//         if(log) console.log("send:", url, "response:", result)
//         if(raw) cb(result)
//         else cb(result.data)
//     })
// }

// create an notification in the bottom right and call a callback when it was clicked
/**
 * creates a notification in the bottom right with a ```title```, ```message``` and ```type```. You also need to define a callback that is called when the notification is clicked
 * @param {string} title the headline of the notification
 * @param {string} message the description of the notification
 * @param {string} type the type of the notification as ```CSS```
 * @param {function} cb the callback of the notification, that is triggerd when the notification is clicked
 * @param {boolean} hideFromCenter to specify wether the notification should be added to the notification center on the top left at the bell icon
 * @returns 
 */
async function notifyCb(title, message, type, cb, hideFromCenter){
    let duration = (1000 * 7) + 1000
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, duration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        cb()
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button><span class="bi bi-arrow-right-bar"></span> Ablehnen</button>
        <button><span class="bi bi-x-circle"></span> Schließen</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
        }
    })
}
// create an notification in the bottom right
/**
 * creates a notification in the bottom right with a ```title```, ```message``` and ```type```
 * @param {string} title the headline of the notification
 * @param {string} message the description of the notification
 * @param {string} type the type of the notification as ```CSS```
 * @param {boolean} hideFromCenter to specify wether the notification should be added to the notification center on the top left at the bell icon
 * @returns 
 */
async function notify(title, message, type, hideFromCenter){
    let duration = (1000 * 7) + 1000
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    })
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, duration)
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button><span class="bi bi-arrow-right-bar"></span> Ablehnen</button>
        <button><span class="bi bi-x-circle"></span> Schließen</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
        }
    })
}
/**
 * creates a notification in the bottom right with a ```title```, ```message```, ```type``` and ```duration```. You also need to define a callback that is called when the notification is clicked
 * @param {string} title the headline of the notification
 * @param {string} message the description of the notification
 * @param {string} type the type of the notification as ```CSS```
 * @param {function} cb the callback of the notification, that is triggerd when the notification is clicked
*  @param {number} duration the duration of the notification before its removed
 * @param {boolean} hideFromCenter to specify wether the notification should be added to the notification center on the top left at the bell icon
 * @returns 
 */
// create an notification in the bottom right with a specified duration and call a callback when it was clicked
async function notifyCb(title, message, type, duration, cb, hideFromCenter){
    let finalDuration = (1000 * 7) + 1000
    if(duration) finalDuration = duration
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, finalDuration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        cb()
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button><span class="bi bi-arrow-right-bar"></span> Ablehnen</button>
        <button><span class="bi bi-x-circle"></span> Schließen</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
        }
    })
}

// create an notification in the bottom right with a specified duration
/**
 * creates a notification in the bottom right with a ```title```, ```message``` and ```type```
 * @param {string} title the headline of the notification
 * @param {string} message the description of the notification
 * @param {string} type the type of the notification as ```CSS```
*  @param {number} duration the duration of the notification before its removed
 * @param {boolean} hideFromCenter to specify wether the notification should be added to the notification center on the top left at the bell icon
 * @returns 
 */
async function notify(title, message, type, duration, hideFromCenter){
    let finalDuration = (1000 * 7) + 1000
    if(duration) finalDuration = duration
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, finalDuration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button><span class="bi bi-arrow-right-bar"></span> Ablehnen</button>
        <button><span class="bi bi-x-circle"></span> Schließen</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
        }
    })
}

// send a notification on the computer, like in windows the toast notification on the bottom right
/**
 * send a notification on the computer, like in windows the toast notification on the bottom right
 * @param {string} title the headline of the notification
 * @param {string} message the message of the notification
 * @returns 
 */
async function notifyComputer(title, message){
    socket.emit("b:notify-computer", title, message)
}

// search for "caccordion" HTML elements and make them clickable if they not already are
/**
 * search for ".caccordion" HTML elements and make them clickable if they not already are
 */
setAccordions()
function setAccordions(){
    const accordions = $(".caccordion").map(function(){return this}).get()
    for (let i = 0; i < accordions.length; i++) {
        const element = accordions[i];
        if($(element).attr("listener") == "true") continue
        $(element).attr("listener", "true")
        $(element).next().click(function(e){
            e.stopImmediatePropagation()
        })
        $(element).next().dblclick(function(e){
            e.stopImmediatePropagation()
        })

        $(element).dblclick(function(e){
            e.stopImmediatePropagation()
        })       
        $(element).click(function(e){
            e.stopImmediatePropagation()
            if($(element).next().hasClass("cpanel")){
                if($(element).next().css("display") == "none"){
                    $(element).next().css("display", $(element).next().attr("flexable") == "true" ? "flex": "block")
                    $(element).addClass("active")
                    $(element).children().last().removeClass("bi-caret-down")
                    $(element).children().last().addClass("bi-caret-up")
                }
                else{
                    $(element).next().css("display", "none")
                    $(element).removeClass("active")
                    $(element).children().last().addClass("bi-caret-down")
                    $(element).children().last().removeClass("bi-caret-up")
                } 
            }
        })
        $(element).append($(document.createElement("i")).addClass(["caccordion-arrow", "bi", "bi-caret-down"]))
    }
}

// get back to last page if it was not the "loading" page
/**
 * get back to last page if it was not the "loading" page
 */
function back(){
    if(!/\S/.test(document.referrer) || document.referrer == location.href ) return
    else history.back()
}


/**
 * creates an dialog with an custom ```title```, ```message``` and ```elements```. You can also set the width and height
 * @param {string} title the headline of the dialog
 * @param {string} message the description of the dialog
 * @param {string} elements the custom elements to add in a string with the ``` `` ``` characters
 * @param {number} width the width of the dialog window in px
 * @param {number} height the height of the dialog window in px
 * @returns {string} the selector as id of the created dialog
 */
function createDialog(title, message, elements, width, height){
    const id = title.replaceAll(" ", "_") + "-dialog"
    const headline = $(document.createElement("uh1")).html(title)
    const description = $(document.createElement("p")).html(message)
    const content = $(document.createElement("div")).addClass("content").append([headline, description, elements])
    if(width) content.css("width", width + "px")
    if(height) content.css("height", height + "px")
    const background = $(document.createElement("div")).addClass("background")
    const dialog = $(document.createElement("div")).attr("id", id).addClass("dialog").append([background, content])
    $("body").prepend(dialog)
    disableScroll()
    return "#" + id
}
/**
 * removes a dialog with a specific ```id```
 * @param {string} id the id of the dialog to remove
 */
function removeDialog(id){
    enableScroll()
    $(id).remove()
}
async function openBrowser(url){
    socket.emit("b:open-url-through-browser", url)
}
