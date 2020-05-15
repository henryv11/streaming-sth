function broadcast(socket, stream) {
  const config = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  };
  const peerConnections = {};
  const recorder = record(stream, socket);

  socket.emit('broadcast');

  socket.on('watch', (id) => {
    console.debug('got new watcher', id);
    const peer = new RTCPeerConnection(config);
    peerConnections[id] = peer;

    peer.addTransceiver;

    stream.getTracks().forEach((track) => {
      console.debug('adding track to peer', peer);
      peer.addTrack(track, stream);
    });

    peer.onicecandidate = (event) => {
      console.debug('got icecandidate', id, event);
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      } else {
        console.warn('no candidate');
      }
    };

    peer
      .createOffer()
      .then((desc) => {
        console.debug('got peer local description', desc);
        peer.setLocalDescription(desc);
      })
      .then(() => socket.emit('offer', id, peer.localDescription));
  });

  socket.on('answer', (id, desc) => {
    console.debug('got answer', id, desc);
    peerConnections[id].setRemoteDescription(desc);
  });

  socket.on('candidate', (id, candidate) => {
    console.debug('got candidate', id, candidate);
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('disconnectPeer', (id) => {
    console.debug('peer disconnected', id);
    peerConnections[id].close();
    delete peerConnections[id];
  });

  return {
    stop() {
      recorder.stop();
      socket.emit('stopBroadcast', Object.keys(peerConnections));
      Object.values(peerConnections).forEach((peer) => {
        peer.close();
      });
    },
    pause() {
      recorder.pause();
    },
    resume() {
      recorder.resume();
    },
    setStream(_stream) {
      recorder.setStream(_stream);
      stream = _stream;

      _stream.getTracks().forEach((track) => {
        Object.values(peerConnections).forEach((peer) => {
          console.debug('adding track to peer', peer);

          peer.addTrack(track, _stream);
        });
      });
    },
  };
}
