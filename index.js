// const server = require('http').createServer()
// const io = require('socket.io')(server)

// io.on('connection', function (client) {
//   console.log('Client Connect...', client.id);

//   client.on('message', function name(data) {
//     io.emit('message', JSON.parse(data))
//   })

//   client.on('disconnect', function () {
//     console.log('Client Disconnect...', client.id)
//   })

//   client.on('error', function (err) {
//     console.log('Received Error from Client:', client.id)
//   })
// })

// var port = 3000;
// server.listen(port, function (e) {
//   if (e) throw e
//   console.log('Listening on port %d', port);
// });

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  const name = process.env.NAME || 'World';
  res.send(`Hello ${name}!`);
});

const port = parseInt(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});