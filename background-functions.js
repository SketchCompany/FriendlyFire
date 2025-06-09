const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const dotenv = require("dotenv")
const tokens = require("./tokens")
const config = require("./background-config").getConfig()
const jwt = require("jsonwebtoken")

dotenv.config()

/**
 * used to check a JSON object for integrity by comparing it with the JSON ```objectToCompare```
 * @param {JSON} objectToCheck the JSON object to compare the keys from with the ```objectToCompare```
 * @param {JSON} objectToCompare the JSON object with the only keys in the ```objectToCheck```
 * @returns true or false whether the JSON objects are equal or not
 */
function checkForIntegrity(objectToCheck, objectToCompare) {
	const keys = Object.keys(objectToCheck)
	const neededKeys = Object.keys(objectToCompare)
	console.log("checkForIntegrity: given keys", keys, "needed keys", neededKeys)
	if (arraysEquaul(keys, neededKeys)) return true
	else return false
}

function arraysEquaul(a, b) {
	if (a === b) return true
	if (a == null || b == null) return false
	if (a.length !== b.length) return false

	const aSorted = Array.from(a)
	const bSorted = Array.from(b)

	for (let i = 0; i < aSorted.length; ++i) {
		if (aSorted[i] !== bSorted[i]) return false
	}
	return true
}

/**
 * checks if the file or directory exists at the given ```path```
 * @param {string} path ```path``` to file or directory to check
 * @returns {boolean} returns true or false, whether the file or directory exists or not
 */
function exists(path) {
	return fs.existsSync(path)
}

/**
 * copys a file at the given ```path```
 * @param {string} path ```path``` to file to copy
 * @param {string} dest ```path``` to new file
 * @returns {null} returns nothing
 */
function copy(path, dest) {
	return new Promise((cb) => {
		fs.copyFile(path, dest, (err) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb()
		})
	})
}

/**
 * removes a file or directory at the given ```path```
 * @param {string} path ```path``` to file or directory to remove
 * @returns {Promise} returns nothing
 */
function remove(path) {
	return new Promise((cb) => {
		fs.rm(path, { recursive: true }, (err) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb()
		})
	})
}

/**
 * move a directory or file to the given ```path```
 * @param {string} path the directory or file to move to the ```dest```
 * @param {string} dest the new directory or file to move to.
 * @returns {Promise}
 */
function move(path, dest) {
	return new Promise((cb) => {
		fs.rename(path, dest, (err) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb()
		})
	})
}

/**
 * reads a directory at the given ```path```
 * @param {string} path the directory to read the files from
 * @returns {Promise<Array<string>>} returns every file in the given directory
 */
function readDir(path) {
	return new Promise((cb) => {
		fs.readdir(path, (err, files) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb(files)
		})
	})
}

/**
 * reads a file at the given ```path```
 * @param {string} path the file to read
 * @returns {Promise<string>} returns the content of the file in string format
 */
function read(path) {
	return new Promise((cb) => {
		fs.readFile(path, (err, data) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb(data.toString())
		})
	})
}

/**
 * writes ```data``` into a file at the given ```path```
 * @param {string} path the path where the file should be created
 * @param {string} data the data in string format to write in the file
 * @returns {Promise}
 */
function write(path, data) {
	return new Promise((cb) => {
		fs.writeFile(path, data, (err) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb()
		})
	})
}

/**
 * creates a directory at the given ```path```
 * @param {string} path the path to create the directory
 * @returns {Promise}
 */
function mkDir(path) {
	return new Promise((cb) => {
		fs.mkdir(path, { recursive: true }, (err) => {
			if (err) {
				console.error(err)
				cb(err)
			} else cb()
		})
	})
}

/**
 * fetches a specific ```url``` with the ```GET``` method and returns the data of the response
 * @param {string} url the url to be fetched
 * @returns {Promise} the data of the response from the fetched url
 */
function get(url) {
	return new Promise(async (cb) => {
		fetch(url)
			.then((response) => response.json())
			.then((result) => {
				console.log("get:", url, "response:", result)
				cb(result.data)
			})
			.catch((err) => {
				console.error("get:", url, "error:", err)
				cb(err)
			})
	})
}

/**
 * fetches a specific ```url``` with the ```POST``` method with the preferred ```data``` as ```JSON``` and returns the data of the response
 * @param {string} url the url to be fetched
 * @param {JSON} data the data that needs to be send to the url
 * @returns {Promise} the data of the response from the fetched url
 */
function send(url, data, raw) {
	return new Promise(async (cb) => {
		fetch(url, { method: "post", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } })
			.then((response) => response.json())
			.then((result) => {
				console.log("send:", url, "response:")
				console.dir(result, { depth: null })
				if (raw) cb(result)
				else cb(result.data)
			})
			.catch((err) => {
				console.error("send:", url, "error:", err)
				cb(err)
			})
	})
}

const algorithm = "aes-256-ctr"
const key = crypto.createHash("sha256").update(tokens.DATA_ENCRYPTION_KEY).digest("hex")

/**
 * used to encrypt ```data``` and return the result
 * @param {string | number | boolean | JSON} data the data that should be encrypted
 * @returns {string} the encrypted data
 */
function encrypt(data) {
	let iv = crypto.randomBytes(16)
	let cipher = crypto.createCipheriv(algorithm, Buffer.from(key, "hex"), iv)
	let encrypted = cipher.update(data)
	encrypted = Buffer.concat([encrypted, cipher.final()])
	return iv.toString("hex") + "$" + encrypted.toString("hex")
}

/**
 * used to decrypt ```data``` and return the result
 * @param {string} data the data that should be decrypted
 * @returns {string} the decrypted data
 */
function decrypt(data) {
	let dataParts = data.split("$")
	let iv = Buffer.from(dataParts.shift(), "hex")
	let encryptedData = Buffer.from(dataParts.join("$"), "hex")
	let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), iv)
	let decrypted = decipher.update(encryptedData)
	decrypted = Buffer.concat([decrypted, decipher.final()])
	return decrypted.toString()
}

/**
 * Validate paths by passing a path `p`
 * @param {string} p path to validate
 * @returns {boolean} true if path is a valid path to a file or directory
 */
function isPathValid(p) {
	try {
		path.resolve(p) // syntaktisch korrekt

		const stats = fs.statSync(p)

		if (stats.isFile() || stats.isDirectory()) {
			return true
		}
		return false
	} catch {
		return false
	}
}

/**
 *
 * @param {string} url the url to get the token ```t``` from
 * @param {string} tokenParam optional change the param which contains the token, default is ```t```
 * @returns {Promise<object> | Promise<null>} a promise containing a string if the token was successfully found and saved, otherwise returns null
 */
function saveTokenFromUrl(url, tokenParam = "t") {
	return new Promise(async (cb) => {
		try {
			const token = new URL(url).searchParams.get(tokenParam)
			console.log("saveTokenFromUrl: login token received", token)

			const user1ID = await authenticate(token)
			if (!user1ID) cb(null)

			const response = await send("https://api.sketch-company.de/u/find", { id: user1ID })
			if (response.status != 1) cb(null)

			if (!exists(config.dataDir)) await mkDir(config.dataDir)

			await write(config.userFile, encrypt(JSON.stringify({ token, user: response.user }, null, 3)))
			console.log("saveTokenFromUrl: saved login token to", config.userFile)

			cb({ token, user: response.user })
		} catch (err) {
			console.error("saveTokenFromUrl:", err)
			cb(null)
		}
	})
}

function authenticate(token) {
	return new Promise((cb) => {
		try {
			if (!token) {
				console.error("authenticate: no token found")
				cb(false)
			}

			jwt.verify(token, tokens.TOKEN_ENCRYPTION_KEY, (err, object) => {
				if (err) {
					console.error("authenticate:", err)
					cb(false)
				}
				cb(object.id)
			})
		} catch (err) {
			console.error("authenticate:", err)
			cb(false)
		}
	})
}

module.exports = {
	write,
	read,
	remove,
	exists,
	copy,
	move,
	mkDir,
	readDir,
	get,
	send,
	encrypt,
	decrypt,
	checkForIntegrity,
	isPathValid,
	saveTokenFromUrl,
	authenticate,
}