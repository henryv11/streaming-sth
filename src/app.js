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
const saveStreams = {};

function handleAvailableVideos(socket) {
  fs.readdir(path.resolve('./static/videos/'), (err, files) => {
    if (err) {
      return console.error('failed to get available videos', err);
    }
    socket.emit('availableVideos', files);
  });
}

function handleAvailableBroadcasters(socket) {
  function mapBroadcaster(acc, id) {
    acc[id] = {};
    return acc;
  }

  socket.emit(
    'availableBroadcasters',
    Object.keys(broadcasters).reduce(mapBroadcaster, {}),
  );
}

io.sockets.on('connection', (socket) => {
  handleAvailableVideos(socket);
  handleAvailableBroadcasters(socket);

  socket.on('watch', (id) => {
    console.debug(socket.id, 'requesting to watch', id);
    socket.to(id).emit('watch', socket.id);
  });

  socket.on('broadcast', () => {
    console.debug('socket', socket.id, 'start broadcasting');
    broadcasters[socket.id] = {};
    handleAvailableBroadcasters(io.sockets);
  });

  socket.on('disconnectPeer', (id) => {
    console.debug('socket', socket.id, 'disconnection from', id);
    socket.to(id).emit('disconnectPeer', socket.id);
  });

  socket.on('offer', (id, message) => {
    console.debug('socket', socket.id, 'sending offer', message, 'to', id);
    socket.to(id).emit('offer', socket.id, message);
  });

  socket.on('stopBroadcast', (watchers) => {
    if (!broadcasters[socket.id]) {
      console.warn('non broadcaster attempting to stop broadcasting');
      return;
    }
    console.debug('stopping broadcast', watchers);
    watchers.forEach((w) => {
      socket.to(w).emit('stopBroadcast');
    });
    if (saveStreams[socket.id]) {
      saveStreams[socket.id].end();
    }
    delete broadcasters[socket.id];
    handleAvailableBroadcasters(io.sockets);
  });

  socket.on('answer', (id, message) => {
    console.debug('socket', socket.id, 'sending answer to', message, 'to', id);
    socket.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    console.debug('socket', socket.id, 'sending candidate', message, 'to', id);
    socket.to(id).emit('candidate', socket.id, message);
  });

  socket.on('startSaveStream', ({ name, fileExtension }) => {
    const writeStream = fs.createWriteStream(
      path.resolve(`./static/videos/${name}.${fileExtension}`),
    );
    writeStream.on('close', () => {
      if (saveStreams[socket.id]) {
        delete saveStreams[socket.id];
      }
      handleAvailableVideos(io.sockets);
    });

    saveStreams[socket.id] = writeStream;
  });

  socket.on('endSaveStream', () => {
    saveStreams[socket.id].end();
  });

  socket.on('saveStream', (data) => {
    saveStreams[socket.id].write(data);
  });

  socket.on('close', () => {
    console.debug(`socket ${socket.id} closing`);

    if (broadcasters[socket.id]) {
      console.debug('removing broadcaster');
      delete broadcasters[socket.id];
      handleAvailableBroadcasters(io.sockets);

      if (saveStreams[socket.id]) {
        console.debug('ending writestream');
        saveStreams[socket.id].end();
      }
    }
  });
});

server.listen(port, () => console.debug('App started'));

process.on('uncaughtException', console.error);
