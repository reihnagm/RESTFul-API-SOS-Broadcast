const express = require("express")
const cors = require("cors")
const app = express()
const axios = require("axios")
const moment = require("moment")
const mysql = require("mysql")
const helmet = require("helmet")
const compression = require("compression")
const multer = require("multer")
const server = require("http").createServer(app)
const io = require("socket.io")(server)

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
})

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
app.use(helmet())
app.use(compression())
app.use(express.static("public"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// SOS

app.get("/get-sos/:user_id", async (req, res) => {
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 30  
  let offset  = (page - 1) * show
  let total = await getSosTotal()
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(resultTotal / show) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
  if(req.params.user_id != "all") {
    try {
      let userId = req.params.user_id
      let sos = await getSos(offset, show, userId)
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
  } else {
    let sos = await getAllSos(offset, show)
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
  }
})

app.post("/store-sos", async (req, res) => {
  try {
    let id = req.body.id 
    let category = req.body.category
    let media_url = req.body.media_url
    let media_url_phone = req.body.media_url_phone
    let desc = req.body.desc
    let lat = req.body.lat
    let lng = req.body.lng
    let address = req.body.address
    let status = req.body.status
    let duration = req.body.duration
    let thumbnail = req.body.thumbnail
    let userName = req.body.username
    let userId = req.body.user_id

    await storeSos(
      id, category, media_url, media_url_phone, desc, status, 
      lat, lng, address,
      duration, thumbnail, userId
    )

    const contacts = await getContact(userId)

    if(contacts.length != 0) {
      for (let i = 0; i < contacts.length; i++) {
        await axios.post('https://console.zenziva.net/wareguler/api/sendWAFile/', {
          userkey: '0d88a7bc9d71',
          passkey: 'df96c6b94cab1f0f2cc136b6',
          link: media_url,
          caption:`${userName} Menjadikan Nomor Anda ${contacts[i].identifier} sebagai Kontak Darurat \n- Amulet`,
          to: contacts[i].identifier
        })
        .then(function (response) {
          return json({
            "status": response.status
          })
        })
        .catch(function (error) {
          return json({
            "status": error.status
          })
        });      
      }
    }
  
    return res.json({
      "status": res.statusCode
    })
  } catch(e) {
    console.log(e)
  }
})

// FCM

app.get("/get-fcm", async (req, res) => {
  try {
    const fcmSecret = await getFcm()
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
  await initFcm(userId, fcmSecret, lat, lng)
  return res.json({
    "user_id": userId,
    "fcm_secret": fcmSecret,
    "lat": lat,
    "lng": lng
  })
})

// INBOX

app.get("/inbox/:user_id", async (req, res) => {
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 30  
  let offset  = (page - 1) * show
  let total = await getInboxTotal()
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(resultTotal / show) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
 
  try {
    let userId = req.params.user_id
    let inboxes = await getInbox(offset, show, userId)
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
    let totalUnread =  await getInboxTotalUnread(userId);
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

app.post("/inbox/store", async (req, res) => {
  let uid = req.body.uid 
  let title = req.body.title
  let content = req.body.content
  let thumbnail = req.body.thumbnail
  let mediaUrl = req.body.media_url
  let type = req.body.type
  let userId = req.body.user_id
  
  await inboxStore(
    uid, title, 
    content, thumbnail, 
    mediaUrl, type, userId
  )

  res.json({
    "status": res.statusCode
  })
})

app.put("/inbox/:uid/update", async (req, res) => {
  let uid = req.params.uid 
  
  await inboxUpdate(uid)

  res.json({
    "status": res.statusCode
  })
})

// CONTACTS

app.get("/contacts/:user_id", async (req, res) => {
  let userId = req.params.user_id
  let data = await getContact(userId)
  res.json({
    "data": data
  })
}) 

app.post("/contacts/store", async (req, res) => {
  let uid = req.body.uid
  let name = req.body.name
  let identifier = req.body.identifier
  let userId = req.body.user_id

  await storeContact(uid, name, identifier, userId)

  res.json({
    "status": res.statusCode
  })
}) 

app.delete("/contacts/:uid/delete", async (req, res) => {
  let uid = req.params.uid
  await destroyContact(uid)
  res.json({
    "status": res.statusCode
  })
})

// MEDIA

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


// SOS

function getSos(offset, limit, userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, 
    a.category, 
    a.media_url, 
    a.media_url_phone,
    a.thumbnail, 
    a.content, 
    a.lat, 
    a.lng, 
    a.address, 
    a.status, 
    a.duration, 
    a.created_at, 
    a.updated_at, 
    b.fullname
    FROM sos a 
    INNER JOIN users b ON a.user_id = b.user_id 
    WHERE a.user_id = '${userId}'
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

function getAllSos(offset, limit) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, 
    a.category, 
    a.media_url, 
    a.media_url_phone,
    a.thumbnail, 
    a.content, 
    a.lat, 
    a.lng, 
    a.address, 
    a.status, 
    a.duration, 
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

function getSosTotal() {
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

function storeSos(uid, category, media_url, media_url_phone, content, status, lat, lng, address, duration, thumbnail, userId) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO sos (uid, category, media_url, 
    media_url_phone, content, lat, lng, address, status, duration, thumbnail, user_id) 
    VALUES ('${uid}',  '${category}', '${media_url}', '${media_url_phone}', '${content}', '${lat}', '${lng}', '${address}', '${status}', '${duration}', '${thumbnail}', '${userId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

// INBOX

function getInboxTotal() {
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

function getInboxTotalUnread(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM inboxes WHERE is_read = 0 AND user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function getInbox(offset, limit, userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM inboxes WHERE user_id='${userId}' LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function inboxStore(uid, title, content, thumbnail, mediaUrl, type, userId) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO inboxes (uid, title, content, thumbnail, media_url, is_read, type, user_id) 
    VALUES ('${uid}', '${title}', '${content}', '${thumbnail}', '${mediaUrl}', 0,
    '${type}' ,'${userId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

function inboxUpdate(uid) {
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

// CONTACTS

function getContact(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM contacts WHERE user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function destroyContact(uid) {
  return new Promise((resolve, reject) => {
    const query = `DELETE FROM contacts WHERE uid = '${uid}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function storeContact(uid, name, identifier, userId) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO contacts (uid, name, identifier, user_id)  
    VALUES('${uid}', '${name}', '${identifier}', '${userId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0])
      }
    })
  })
}

// FCM

function getFcm() {
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

function initFcm(uid, fcmSecret, lat, lng) {
  return new Promise((resolve, reject) => {
    const query = `REPLACE INTO fcm (uid, fcm_secret, lat, lng) VALUES 
    ('${uid}', '${fcmSecret}', '${lat}', '${lng}')`
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