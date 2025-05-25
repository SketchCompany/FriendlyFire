const express = require("express")
const router = express.Router()
const fs = require("fs")
const path = require("path")

router.get("/res", (req, res) => {
    try{
        if(fs.existsSync(__dirname + "/frontend/" + req.query.f)){
            res.sendFile(__dirname + "/frontend/" + req.query.f)
        }
        else{
            res.status(404).send("<h1>Error 404</h1><br><p>" + "Resource could not be found" + "</p>")
            console.error(req.path, "file could not be found at", __dirname + "/frontend/" + req.query.f)
        } 
    }
    catch(err){
        console.error(err)
        res.status(404).send("<h1>Error 404</h1><br><p>" + err + "</p>")
    }
})

router.get("*", (req, res) => {
	try{
		if(req.path == "/socket.io/socket.io.js") return

		if(fs.existsSync(__dirname + "/frontend/" + req.path + "/index.html")) {
			res.sendFile(__dirname + "/frontend/" + req.path + "/index.html")
		} 
        else{
            res.status(404).send("<h1>Error 404</h1><br><p>" + "File could not be found" + "</p>")
            console.error(req.path, "file could not be found at", __dirname + "/frontend/" + req.path + "/index.html")
        }
	} 
    catch(err){
		console.error(err)
		res.status(404).send("<h1>Error 404</h1><br><p>" + err + "</p>")
	}
})

module.exports = router