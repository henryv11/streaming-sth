const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;

const app = express();
const server = http.createServer(app);
const io = require('socket.io').listen(server);

app.use(express.static('static'));

const broadcasters = {};

function handleAvailableVideos(socket) {
  fs.readdir(path.resolve('./static/videos/'), (err, files) => {
    if (err) {
      return console.error('failed to get available videos', err);
    }
    socket.emit('availableVideos', files);
  });
}

function handleAvailableBroadcasters(socket) {
  socket.emit('availableBroadcasters', broadcasters);
}

io.sockets.on('connection', (socket) => {
  let writeStream;

  handleAvailableVideos(socket);
  handleAvailableBroadcasters(socket);

  socket.on('watch', (id) => {
    console.debug('requesting to watch');
    socket.to(id).emit('watch', socket.id);
  });

  socket.on('broadcast', () => {
    broadcasters[socket.id] = {};
    handleAvailableBroadcasters(io.sockets);
  });

  socket.on('disconnect', (id) => {
    socket.to(id).emit('disconnectPeer', socket.id);
  });

  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  socket.on('stopBroadcast', (watchers) => {
    console.debug('stopping broadcast', watchers);
    watchers.forEach((w) => {
      socket.to(w).emit('stopBroadcast');
    });
    delete broadcasters[socket.id];
    handleAvailableBroadcasters(io.sockets);
  });

  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });

  socket.on('startSaveStream', ({ name, fileExtension }) => {
    writeStream = fs.createWriteStream(
      path.resolve(`./static/videos/${name}.${fileExtension}`),
    );
    writeStream.on('close', () => {
      writeStream = undefined;
      handleAvailableVideos(io.sockets);
    });
  });

  socket.on('endSaveStream', () => {
    writeStream.end();
  });

  socket.on('saveStream', (data) => {
    writeStream.write(data);
  });

  socket.on('close', () => {
    console.debug(`socket ${socket.id} closing`);

    if (broadcasters[socket.id]) {
      console.debug('removing broadcaster');
      delete broadcasters[socket.id];
      handleAvailableBroadcasters(io.sockets);
    }

    if (writeStream) {
      console.debug('ending writestream');
      writeStream.end();
    }
  });
});

server.listen(port, () => console.log('App started'));

process.on('uncaughtException', console.error);
