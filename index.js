const express = require("express")
const cors = require("cors")
const app = express()
const axios = require("axios")
const moment = require("moment")
moment.locale('id')
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

  client.on('broadcast', function name(data) {
    const result = JSON.parse(data)
    io.emit('broadcast', result)
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

app.get("/get-agent-sos/:user_id", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let show = parseInt(req.query.show) || 30  
    let userId = req.params.user_id
    let offset  = (page - 1) * show
    let total = await getAgentSosTotal()
    let resultTotal = Math.ceil(total / show) 
    let perPage = Math.ceil(show / resultTotal) 
    let prevPage = page === 1 ? 1 : page - 1
    let nextPage = page === perPage ? 1 : page + 1
    let sos = await getAgentSos(offset, show, userId)
    let arr = []
    for(let i = 0; i < sos.length; i++) {
      arr.push({
        "uid": sos[i].uid,
        "sender": {
          "id": sos[i].sender_id,
          "name": sos[i].sender_name,
          "fcm": sos[i].sender_fcm
        },
        "is_confirm": sos[i].is_confirm,
        "as_name": sos[i].as_name,
        "sign_id": sos[i].sign_id,
        "accept_name": sos[i].accept_name,
        "category": sos[i].category,
        "content": sos[i].content,
        "media_url_phone": sos[i].media_url_phone,
        "thumbnail": sos[i].thumbnail,
        "lat": sos[i].lat,
        "lng": sos[i].lng,
        "address": sos[i].address,
        "created_at": sos[i].created_at
      })
    }
    return res.json({
      "data": arr,
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

app.get("/check-agent-ongoing/:user_id", async(req, res) => {
  try {
    let userId = req.params.user_id
    let data = await checkAgentOngoing(userId)
    if(data == 1) {
      return res.json({
        "status": res.statusCode,
        "data": "exist"
      })
    } else {
      return res.json({
        "status": res.statusCode,
        "data": "not_exist"
      })
    }
  } catch(e) { 
    console.log(e)
  }
})

app.get("/get-agent-ongoing/:user_id", async (req, res) => {
  try {
    let userId = req.params.user_id
    let data = await getAgentOngoing(userId)
    if(data == null) return res.json({
      "data":{
        "agent": "not_available" 
      },
      "status": res.statusCode
    }) 
    const response = await axios.get(`https://maps.googleapis.com/maps/api/directions/json?origin=${data.sender_lat},${data.sender_lng}&destination=${data.agent_lat},${data.agent_lng}&key=AIzaSyBFRpXPf8BXaR22nDvvx2ghBfbUbGGX8N8`)  
    const d = response.data
    let agentObj = {}
    agentObj.sign_id = data.sign_id
    agentObj.as_name = data.as_name
    agentObj.media_url = data.media_url
    agentObj.thumbnail = data.thumbnail
    agentObj.media_url_phone = data.media_url_phone
    agentObj.name = data.agent_name
    agentObj.agent_lat = data.agent_lat
    agentObj.agent_lng = data.agent_lng   
    agentObj.sender_lat = data.sender_lat
    agentObj.sender_lng = data.sender_lng     
    agentObj.est = `${d.routes[0].legs[0].distance.text} ${d.routes[0].legs[0].duration.text}`

    return res.json({
      "data":{
        "agent": agentObj 
      },
      "status": res.statusCode 
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/get-history-agent-sos/:user_accept_id", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let show = parseInt(req.query.show) || 10  
    let userAcceptId = req.params.user_accept_id
    let offset  = (page - 1) * show
    let total = await getHistoryAgentSosTotal(userAcceptId)
    let resultTotal = Math.ceil(total / show) 
    let perPage = Math.ceil(show / resultTotal) 
    let prevPage = page === 1 ? 1 : page - 1
    let nextPage = page === perPage ? 1 : page + 1
    let sos = await getHistoryAgentSos(offset, show, userAcceptId)
    let arr = []
    for(let i = 0; i < sos.length; i++) {
      arr.push({
        "uid": sos[i].uid,
        "sender": {
          "id": sos[i].sender_id,
          "name": sos[i].sender_name,
          "fcm": sos[i].sender_fcm
        },
        "is_confirm": sos[i].is_confirm,
        "as_name": sos[i].as_name,
        "sign_id": sos[i].sign_id,
        "accept_name": sos[i].accept_name,
        "category": sos[i].category,
        "content": sos[i].content,
        "media_url_phone": sos[i].media_url_phone,
        "thumbnail": sos[i].thumbnail,
        "lat": sos[i].lat,
        "lng": sos[i].lng,
        "address": sos[i].address,
        "created_at": sos[i].created_at
      })
    }
    return res.json({
      "data": arr,
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

app.get("/get-history-sos/:is_confirm/:user_id", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let show = parseInt(req.query.show) || 10  
    let isConfirm = req.params.is_confirm
    let userId = req.params.user_id
    let offset  = (page - 1) * show
    let total = await getHistorySosTotal(userId)
    let resultTotal = Math.ceil(total / show) 
    let perPage = Math.ceil(show / resultTotal) 
    let prevPage = page === 1 ? 1 : page - 1
    let nextPage = page === perPage ? 1 : page + 1
    let sos = await getHistorySos(offset, show, isConfirm, userId)
    let arr = []
    for(let i = 0; i < sos.length; i++) {
      arr.push({
        "uid": sos[i].uid,
        "sender": {
          "id": sos[i].sender_id,
          "name": sos[i].sender_name,
          "fcm": sos[i].sender_fcm
        },
        "is_confirm": sos[i].is_confirm,
        "as_name": sos[i].as_name,
        "sign_id": sos[i].sign_id,
        "accept_name": sos[i].accept_name,
        "category": sos[i].category,
        "content": sos[i].content,
        "media_url_phone": sos[i].media_url_phone,
        "thumbnail": sos[i].thumbnail,
        "lat": sos[i].lat,
        "lng": sos[i].lng,
        "address": sos[i].address,
        "created_at": sos[i].created_at
      })
    }
    return res.json({
      "data": arr,
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

app.put("/accept-sos", async (req, res) => {
  try {
    let sosId = req.body.sos_id
    let userAcceptId = req.body.user_accept_id
    let lat = req.body.lat
    let lng = req.body.lng
    let affected = await acceptSosConfirm(sosId, userAcceptId, lat, lng)
    if(affected > 0) {
      return res.json({
        "status": res.statusCode
      })
    } else {
      return res.json({
        "status": 400
      })
    }
  } catch(e) {
    console.log(e)
  }
})

app.put("/finish-sos", async (req, res) => {
  try {
    let sosId = req.body.sos_id
    let userAcceptId = req.body.user_accept_id
    await finishSosConfirm(sosId, userAcceptId)
    return res.json({
      "status": res.statusCode
    })
  } catch(e) {
    console.log(e)
  }
})

app.get("/get-sos/:user_id", async (req, res) => {
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 10  
  let offset  = (page - 1) * show
  let total = await getSosTotal()
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(show / resultTotal) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
  if(req.params.user_id != "all") {
    try {
      let userId = req.params.user_id
      let arr = []
      let sos = await getSos(offset, show, userId)
      for (let i = 0; i < sos.length; i++) {
        arr.push({
          "uid": sos[i]["uid"],
          "category": sos[i]["category"],
          "media_url": sos[i]["media_url"],
          "media_url_phone": sos[i]["media_url_phone"],
          "thumbnail": sos[i]["thumbnail"],
          "sign_id": sos[i]["sign_id"],
          "content": sos[i]["content"],
          "lat": sos[i]["lat"],
          "lng": sos[i]["lng"],
          "address": sos[i]["address"],
          "status": sos[i]["status"],
          "duration": sos[i]["duration"],
          "created_at": moment(sos[i]["created_at"]).format('MMMM Do YYYY, h:mm:ss a'),
          "updated_at": moment(sos[i]["updated_at"]).format('MMMM Do YYYY, h:mm:ss a'),
          "fullname": sos[i]["fullname"],
          "phone_number": sos[i]["phone_number"]
        })
      }
      return res.json({
        "data": arr,
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
    let arr = []
    let sos = await getAllSos(offset, show)
    for (let i = 0; i < sos.length; i++) {
      arr.push({
        "uid": sos[i]["uid"],
        "category": sos[i]["category"],
        "media_url": sos[i]["media_url"],
        "media_url_phone": sos[i]["media_url_phone"],
        "thumbnail": sos[i]["thumbnail"],
        "sign_id": sos[i]["sign_id"],
        "content": sos[i]["content"],
        "lat": sos[i]["lat"],
        "lng": sos[i]["lng"],
        "address": sos[i]["address"],
        "status": sos[i]["status"],
        "duration": sos[i]["duration"],
        "created_at": moment(sos[i]["created_at"]).format('Do MMMM YYYY, hh:mm:ss'),
        "updated_at": moment(sos[i]["updated_at"]).format('Do MMMM YYYY, hh:mm:ss'),
        "fullname": sos[i]["fullname"],
        "phone_number": sos[i]["phone_number"]
      })
    }
    return res.json({
      "data": arr,
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
    let signId = req.body.sign_id
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
      id, category, media_url, media_url_phone, 
      desc, status, 
      lat, lng, address,
      duration, thumbnail, userId, signId
    )

    try {
      await storeSosConfirm(id, userId)
    } catch(e) {
      console.log(e)
    }

    const contacts = await getContact(userId)

    if(contacts.length != 0) {
      for (let i = 0; i < contacts.length; i++) {
        try {
          await axios.post('https://console.zenziva.net/wareguler/api/sendWAFile/', {
            userkey: '0d88a7bc9d71',
            passkey: 'df96c6b94cab1f0f2cc136b6',
            link: media_url,
            caption:`${userName} Menjadikan Nomor Anda ${contacts[i].identifier} sebagai Kontak Darurat \n- Amulet`,
            to: contacts[i].identifier
          })  
        } catch(e) {
          console.log(e)
        }
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

// INBOX

app.get("/inbox/:user_id", async (req, res) => {
  let page = parseInt(req.query.page) || 1
  let show = parseInt(req.query.show) || 10  
  let userId = req.params.user_id
  let type = req.query.type
  let offset  = (page - 1) * show
  let total = await getInboxTotal(userId, type)
  let resultTotal = Math.ceil(total / show) 
  let perPage = Math.ceil(show / resultTotal) 
  let prevPage = page === 1 ? 1 : page - 1
  let nextPage = page === perPage ? 1 : page + 1
 
  try {
    let inboxes = await getInbox(offset, show, userId, type)
    let inboxesAssign = [];
    for (let i = 0; i < inboxes.length; i++) {
      inboxesAssign.push({
        "uid": inboxes[i].uid,
        "is_read": inboxes[i].is_read,
        "title": inboxes[i].title,
        "type": inboxes[i].type,
        "media_url": inboxes[i].media_url,
        "thumbnail": inboxes[i].thumbnail,
        "content": inboxes[i].content,
        "created_at": moment(inboxes[i].created_at).format('MMMM Do YYYY, h:mm:ss'),
        "updated_at": moment(inboxes[i].created_at).format('MMMM Do YYYY, h:mm:ss')
      })
    }
    return res.json({
      "data": inboxesAssign,
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

app.get("/inbox/count/:user_id", async(req, res) => {
  let userId = req.params.user_id
  let totalUnread =  await getInboxTotalUnread(userId);
  return res.json({
    "total_unread": totalUnread
  })
})

app.post("/inbox/check", async(req, res) => {
  let title = req.body.title
  let totalCheckInbox = await checkInbox(title)
  res.json({
    "total": totalCheckInbox 
  })
})
 
app.post("/inbox/store", async (req, res) => {
  let uid = req.body.uid 
  let title = req.body.title
  let content = req.body.content
  let thumbnail = req.body.thumbnail
  let mediaUrl = req.body.media_url
  let type = req.body.type
  let userId = req.body.user_id
  
  let totalCheckInboxCount = await checkInbox(title)

  if(type != "info") {
    if(totalCheckInboxCount != 1) {
      await inboxStore(
        uid, title, 
        content, thumbnail, 
        mediaUrl, type, userId
      )
    }
  } else {
    await inboxStore(
      uid, title, 
      content, thumbnail, 
      mediaUrl, type, userId
    )
  }

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
    a.sign_id, 
    a.content, 
    a.lat, 
    a.lng, 
    a.address, 
    a.status, 
    a.duration, 
    a.created_at, 
    a.updated_at, 
    b.fullname,
    b.phone_number
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
    a.sign_id,
    a.content, 
    a.lat, 
    a.lng, 
    a.address, 
    a.status, 
    a.duration, 
    a.created_at, 
    a.updated_at, 
    b.fullname,
    b.phone_number
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

// function checkSosAgentProcess() {
//   return new Promise((resolve, reject) => {
//     const query = `SELECT a.* FROM users a
//     JOIN sos_confirms b
//     ON a.user_id = b.user_accept_id
//     WHERE is_confirm NOT IN (SELECT is_confirm FROM sos_confirms WHERE is_confirm = 1)
//     AND a.role = "agent`
//     conn.query(query, (e, res) => {
//       if(e) {
//         reject(new Error(e))
//       } else {
//         resolve(res)
//       }
//     })
//   })
// }

function storeSos(uid, category, media_url, media_url_phone, content, status, lat, lng, address, duration, thumbnail, userId, signId) {
  return new Promise((resolve, reject) => {
    const query = `
    REPLACE INTO sos (uid, category, media_url, 
    media_url_phone, content, lat, lng, address, status, duration, thumbnail, user_id, sign_id) 
    VALUES ('${uid}', '${category}', '${media_url}', '${media_url_phone}', '${content}', '${lat}', '${lng}', '${address}', '${status}', '${duration}', '${thumbnail}', '${userId}', '${signId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function storeSosConfirm(sosId, userId) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO sos_confirms (sos_uid, is_confirm, user_sender_id, as_name) 
    VALUES('${sosId}', '0', '${userId}', 'Agent')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res)
      }
    })
  })
}

function getHistorySos(offset, limit, confirm, userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, a.media_url_phone, b.is_confirm, b.as_name, a.thumbnail, a.sign_id, c.user_id sender_id, c.fullname sender_name, f.fcm_secret sender_fcm, 
    IFNULL(d.fullname, '-') accept_name, a.category, a.content, a.lat, 
    a.lng, a.address, a.created_at FROM sos a 
    LEFT JOIN sos_confirms b ON a.uid = b.sos_uid
    LEFT JOIN users d ON b.user_accept_id = d.user_id 
    LEFT JOIN fcm f ON f.uid = a.user_id
    INNER JOIN users c ON a.user_id = c.user_id 
    WHERE b.is_confirm = '${confirm}' OR b.is_confirm = '2' 
    AND a.user_id = '${userId}'
    ORDER BY a.id DESC LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res)
      }
    })
  })
}

function getHistorySosTotal(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM sos a
    LEFT JOIN sos_confirms b ON a.uid = b.sos_uid
    WHERE is_confirm = '1' OR is_confirm = '2'
    AND a.user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {  
        resolve(res[0].total)
      }
    })
  })
}

function getHistoryAgentSos(offset, limit, userAcceptId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.uid, a.media_url_phone, b.is_confirm, b.as_name, a.thumbnail, a.sign_id, c.user_id sender_id, c.fullname sender_name, f.fcm_secret sender_fcm, 
    IFNULL(d.fullname, '-') accept_name, a.category, a.content, a.lat, 
    a.lng, a.address, a.created_at FROM sos a 
    LEFT JOIN sos_confirms b ON a.uid = b.sos_uid
    LEFT JOIN users d ON b.user_accept_id = d.user_id 
    LEFT JOIN fcm f ON f.uid = a.user_id
    INNER JOIN users c ON a.user_id = c.user_id 
    AND b.user_accept_id = '${userAcceptId}'
    ORDER BY b.is_confirm ASC LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res)
      }
    })
  })
}

function getHistoryAgentSosTotal(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM sos a
    LEFT JOIN sos_confirms b ON a.uid = b.sos_uid
    WHERE is_confirm = '1' OR is_confirm = '2'
    AND b.user_accept_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {  
        resolve(res[0].total)
      }
    })
  })
}

function checkAgentOngoing(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM users a
    WHERE a.user_id IN (SELECT sc.user_accept_id FROM sos_confirms sc 
    WHERE sc.is_confirm = 1 AND sc.user_sender_id = '${userId}')`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res[0].total)
      }
    })
  })
}

function getAgentOngoing(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT a.sign_id, f2.lat sender_lat, f2.lng sender_lng, sc1.as_name, a.thumbnail, a.media_url, a.media_url_phone, us.fullname agent_name, 
    f1.lat agent_lat, f1.lng agent_lng 
    FROM sos a 
    INNER JOIN users u 
    ON a.user_id = u.user_id 
    INNER JOIN sos_confirms sc1
    ON a.uid = sc1.sos_uid 
    INNER JOIN users us 
    ON us.user_id = sc1.user_accept_id 
    INNER JOIN fcm f1 
    ON us.user_id = f1.uid
    INNER JOIN fcm f2
    ON a.user_id = f2.uid 
    WHERE a.user_id = '${userId}'
    AND sc1.is_confirm = 1`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res[0])
      }
    })
  })
}

function getAgentSos(offset, limit, userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT s.uid, s.media_url_phone, sc.is_confirm, sc.as_name, 
    s.thumbnail, s.sign_id, us.user_id sender_id,
    us.fullname sender_name, f.fcm_secret sender_fcm, u.fullname accept_name,
    s.category, s.content, s.lat, s.lng, s.address, s.created_at
    FROM sos s 
    INNER JOIN users u ON u.user_id = '${userId}'
    INNER JOIN sos_confirms sc ON sc.sos_uid  = s.uid
    INNER JOIN users us ON sc.user_sender_id = us.user_id 
    INNER JOIN fcm f ON us.user_id  = f.uid
    WHERE u.role = 'agent'
    AND u.user_id NOT IN (SELECT sc2.user_accept_id FROM sos_confirms sc2 
    WHERE sc2.is_confirm = 1)
    AND sc.is_confirm = 0
    ORDER BY s.id DESC LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res)
      }
    })
  })
}

function getAgentSosTotal() {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM sos a
    LEFT JOIN sos_confirms b ON a.uid = b.sos_uid
    WHERE b.is_confirm = 0`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {  
        resolve(res[0].total)
      }
    })
  })
}


function finishSosConfirm(sosId, userAcceptId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE sos_confirms SET is_confirm = 2, user_accept_id = '${userAcceptId}' WHERE sos_uid = '${sosId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        resolve(res)
      }
    })
  })
}

function acceptSosConfirm(sosId, userAcceptId, lat, lng) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE sos_confirms SET is_confirm = 1, lat = '${lat}', lng = '${lng}', user_accept_id = '${userAcceptId}' 
    WHERE sos_uid = '${sosId}' 
    AND is_confirm = '0'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e)) 
      } else {
        console.log(res.changedRows)
        resolve(res.changedRows)
      }
    })
  })
}

// INBOX

function getInboxTotal(userId, type) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM inboxes WHERE user_id = '${userId}' 
    AND type = '${type}'`
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
    const query = `SELECT COUNT(*) AS total FROM inboxes WHERE is_read = 0 AND user_id = '${userId}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0].total)
      }
    })
  })
}

function getInbox(offset, limit, userId, type) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM inboxes WHERE user_id = '${userId}'
    AND type = '${type}'
    ORDER BY id DESC LIMIT ${offset}, ${limit}`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res)
      }
    })
  })
}

function checkInbox(title) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS total FROM inboxes WHERE title = '${title}'`
    conn.query(query, (e, res) => {
      if(e) {
        reject(new Error(e))
      } else {
        resolve(res[0].total)
      }
    })
  })
}

function inboxStore(uid, title, content, thumbnail, mediaUrl, type, userId) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO inboxes (uid, title, content, thumbnail, media_url, is_read, type, user_id) 
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
    const query = `SELECT a.*, b.role, IFNULL(b.fullname, '-') fullname 
    FROM fcm a LEFT JOIN users b 
    ON a.uid = b.user_id
    WHERE a.uid NOT IN (SELECT sc.user_accept_id FROM sos_confirms sc WHERE sc.is_confirm = 1)
    AND b.role = 'agent'`
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