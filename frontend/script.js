const socket = io()
$(".login").click(openLoginDialog)

function openLoginDialog(){
    //createDialog("Anmelden", "Melde ich mit deinem Sketch Company account an")
    socket.emit("b:login-through-browser")
}