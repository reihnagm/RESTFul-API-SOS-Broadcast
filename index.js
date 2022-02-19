const express = require("express")
const cors = require("cors")
const app = express()
const mysql = require('mysql')
const multer = require('multer')
const server = require('http').createServer(app)
const io = require('socket.io')(server)

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    if(file.mimetype == "image/jpeg") {
      callback(null, "./public/thumbnails")
    } else {
      callback(null, "./public/videos")
    }
  },
  filename: (req, file, callback) => {
    callback(null, file.originalname)
  }
})

const upload = multer({
  storage
})

let conn = mysql.createConnection({
  host:'68.183.234.187',
  user:'root',
  port: '3307',
  password:'cx2021!',
  database: 'sos'
});

conn.connect(function(e) {
  if (e) {
    return console.log(e.message);
  }
  console.log('Connected to the MySQL Server');
});

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get("/fetch-sos", async (req, res) => {
  try {
    let sos = await fetchSos()
    return res.json({
      "data": sos
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/insert-sos", async (req, res) => {
  try {
    let id = req.body.id 
    let category = req.body.category
    let media_url = req.body.media_url
    let desc = req.body.desc
    let lat = req.body.lat
    let lng = req.body.lng
    let status = req.body.status
    let duration = req.body.duration
    let thumbnail = req.body.thumbnail

    await insertSos(id, category, media_url, desc, status, lat, lng, duration, thumbnail)

    return res.json({
      "id": id,
      "content": desc,
      "media_url": media_url,
      "category": category,
      "lat": lat,
      "lng": lng,
      "status": status,
      "duration": duration,
      "thumbnail": thumbnail
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/fetch-fcm", async (req, res) => {
  try {
    const fcmSecret = await fetchFcm()
    return res.json({
      "fcm_secret": fcmSecret
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/init-fcm", async (req, res) => {
  let fcmSecret = req.body.fcm_secret
  let lat = req.body.lat
  let lng = req.body.lng
  try {
    await initFcm("origin", fcmSecret, lat, lng)
    return res.json({
      "fcm_secret": fcmSecret,
      "lat": lat,
      "lng": lng
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/upload", upload.single("video"), (req, res) => {
  let filename
  if(req.file) {
    filename = req.file.originalname
    res.json({
      "url": `http://cxid.xyz:3000/videos/${filename}`
    })
  } else {
    res.json({
      "url": ""
    })
  }
})

app.post("/upload-thumbnail", upload.single("thumbnail"), (req, res) => {
  let filename
  if(req.file) {
    filename = req.file.originalname
    res.json({
      "url": `http://cxid.xyz:3000/videos/${filename}`
    })
  } else {
    res.json({
      "url": ""
    })
  }
})

function fetchSos() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM sos ORDER BY created_at DESC`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function insertSos (uid, category, media_url, content, status, lat, lng, duration, thumbnail) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO sos (uid, category, media_url, content, lat, lng, status, duration, thumbnail) 
    VALUES ('${uid}',  '${category}', '${media_url}', '${content}', '${lat}', '${lng}', '${status}', '${duration}', '${thumbnail}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function fetchFcm () {
  return new Promise((resolve, reject) => {
    const query = `SELECT fcm_secret FROM fcm WHERE uid = 'origin'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0].fcm_secret)
      }
    })
  })
}

function initFcm (uid, fcmSecret, lat, lng) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO fcm (uid, fcm_secret, lat, lng) VALUES ('${uid}', '${fcmSecret}', '${lat}', '${lng}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

app.get("*", (req, res) => {
  res.sendStatus(404)
})

const port = 3000;
server.listen(port, function (e) {
  if (e) throw e
  console.log('Listening on port %d', port);
});