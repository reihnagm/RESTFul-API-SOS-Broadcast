const express = require("express")
const cors = require("cors")
const app = express()
const multer = require('multer')
const server = require('http').createServer(app)
const io = require('socket.io')(server)

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "./public/videos")
  },
  filename: (req, file, callback) => {
    callback(null, file.originalname)
  }
})

const upload = multer({
  storage
})

io.on('connection', function (client) {
  console.log('Client Connect...', client.id);

  client.on('message', function name(data) {
    const result = JSON.parse(data)
    io.emit('message', result)
  })

  client.on('disconnect', function () {
    console.log('Client Disconnect...', client.id)
  })

  client.on('error', function (err) {
    console.log('Received Error from Client:', client.id)
  })
})

app.use(cors())
app.use(express.static("public"))

app.post("/upload", upload.single("video"), (req, res) => {
  let filename
  if(req.file) {
    filename = req.file.originalname
    res.json({
      "url": `http://192.168.113.73:3000/public/videos/${filename}`
    })
  } else {
    res.json({
      "url": ""
    })
  }
})

app.get("*", (req, res) => {
  res.sendStatus(404)
})

const port = 3000;
server.listen(port, function (e) {
  if (e) throw e
  console.log('Listening on port %d', port);
});