const express = require("express")
const cors = require("cors")
const app = express()
const moment = require("moment")
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
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 30  
  let offset  = (page - 1) * show
  let total = await fetchSosTotal()
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(resultTotal / show) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
 
  try {
    let sos = await fetchSos(offset, show)
    return res.json({
      "data": sos,
      "total": total,
      "perPage": perPage,
      "nextPage": nextPage,
      "prevPage": prevPage,
      "currentPage": page,
      "nextUrl": `http://cxid.xyz:3000${req.originalUrl.replace('page=' + page, 'page=' + nextPage)}`,
      "prevUrl": `http://cxid.xyz:3000${req.originalUrl.replace('page=' + page, 'page=' + prevPage)}`,
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
    let address = req.body.address
    let status = req.body.status
    let duration = req.body.duration
    let thumbnail = req.body.thumbnail
    let userId = req.body.user_id

    await insertSos(id, category, media_url, desc, status, lat, lng, address, duration, thumbnail, userId)

    return res.json({
      "id": id,
      "content": desc,
      "media_url": media_url,
      "category": category,
      "lat": lat,
      "lng": lng,
      "address": address,
      "status": status,
      "duration": duration,
      "thumbnail": thumbnail,
      "user_id": userId
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/fetch-fcm", async (req, res) => {
  try {
    const fcmSecret = await fetchFcm()
    return res.json({
      "data": fcmSecret
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/init-fcm", async (req, res) => {
  let userId = req.body.user_id
  let fcmSecret = req.body.fcm_secret
  let lat = req.body.lat
  let lng = req.body.lng
  try {
    await initFcm(userId, fcmSecret, lat, lng)
    return res.json({
      "user_id": userId,
      "fcm_secret": fcmSecret,
      "lat": lat,
      "lng": lng
    })
  } catch(e) {
    console.log(e)
  }
})

app.post("/inboxes/create", async (req, res) => {
  let uid = req.body.uid 
  let title = req.body.title
  let content = req.body.content
  let userId = req.body.userId
  
  await inboxesStore(uid, title, content, userId)

  res.json({
    "status": res.statusCode,
  })
});

app.put("/inboxes/update/:uid", async (req, res) => {
  let uid = req.params.uid 
  
  await inboxesUpdate(uid, 1)

  res.json({
    "status": res.statusCode,
  })
});

app.get("/inboxes/:user_id", async (req, res) => {
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 30  
  let offset  = (page - 1) * show
  let total = await fetchInboxesTotal()
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(resultTotal / show) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
 
  try {
    let userId = req.params.user_id
    let inboxes = await fetchInboxes(offset, show, userId)
    let inboxesAssign = [];
    for (let i = 0; i < inboxes.length; i++) {
      inboxesAssign.push({
        "uid": inboxes[i].uid,
        "is_read": inboxes[i].is_read,
        "title": inboxes[i].title,
        "content": inboxes[i].content,
        "created_at": moment(inboxes[i].created_at).format('MMMM Do YYYY, h:mm:ss a'),
        "updated_at": moment(inboxes[i].created_at).format('MMMM Do YYYY, h:mm:ss a')
      })
    }
    let totalUnread =  await fetchTotalInboxesUnread();
    return res.json({
      "data": inboxesAssign,
      "total_unread": totalUnread.length,
      "total": total,
      "perPage": perPage,
      "nextPage": nextPage,
      "prevPage": prevPage,
      "currentPage": page,
      "nextUrl": `http://cxid.xyz:3000${req.originalUrl.replace('page=' + page, 'page=' + nextPage)}`,
      "prevUrl": `http://cxid.xyz:3000${req.originalUrl.replace('page=' + page, 'page=' + prevPage)}`,
    })
  } catch(e) {
    console.log(e)
  }
});

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

function fetchSos(offset, limit) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, 
    a.category, 
    a.media_url, 
    a.thumbnail, 
    a.content, 
    a.lat, 
    a.lng, 
    a.address, 
    a.status, 
    a.duration, 
    a.user_id, 
    a.created_at, 
    a.updated_at, 
    b.fullname
    FROM sos a 
    INNER JOIN users b ON a.user_id = b.user_id 
    ORDER BY a.created_at DESC LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function fetchTotalInboxesUnread() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM inboxes WHERE is_read = 0`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function fetchInboxes(offset, limit, userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM inboxes WHERE user_id = '${userId}' LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function fetchSosTotal() {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM sos`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0].total)
      }
    })
  })
}


function fetchInboxesTotal() {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM inboxes`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0].total)
      }
    })
  })
}

function inboxesStore (uid, title, content, userId) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO inboxes (uid, title, content, is_read) 
    VALUES ('${uid}', '${title}', '${content}', 0, '${userId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function inboxesUpdate(uid) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE inboxes SET is_read = 1 WHERE uid = '${uid}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function insertSos (uid, category, media_url, content, status, lat, lng, address, duration, thumbnail, userId) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO sos (uid, category, media_url, content, lat, lng, address, status, duration, thumbnail, user_id) 
    VALUES ('${uid}',  '${category}', '${media_url}', '${content}', '${lat}', '${lng}', '${address}', '${status}', '${duration}', '${thumbnail}', '${userId}')`
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
    const query = `SELECT a.*, b.fullname FROM fcm a INNER JOIN users b ON a.uid = b.user_id`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
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