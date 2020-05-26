function broadcast(socket, _stream) {
  const config = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  };
  const peerConnections = {};
  let stream = _stream;

  socket.emit('broadcast');
  const recorder = record(stream, socket);

  socket.on('watch', (id) => {
    console.debug('got new watcher', id);

    if (peerConnections[id]) {
      console.debug('already watching');
      return;
    }

    const peer = new RTCPeerConnection(config);
    peerConnections[id] = peer;

    stream.getTracks().forEach((track) => {
      console.debug('adding track to peer', peer);
      peer.addTrack(track, stream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.debug('got icecandidate from peer', id, event);
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
    console.debug('got answer from server', id, desc);
    peerConnections[id].setRemoteDescription(desc);
  });

  socket.on('candidate', (id, candidate) => {
    console.debug('got candidate from server', id, candidate);
    console.log(peerConnections[id].canTrickleIceCandidates);
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
      console.debug('setting new stream to broadcast', stream);
      stream = _stream;
      recorder.setStream(stream);

      Object.values(peerConnections).forEach((peer) => {
        console.log(peer, peer.getSenders());
        peer.getSenders().forEach((sender) => {
          stream.getTracks().forEach((t) => {
            t.enabled = true;
            sender.replaceTrack(t, stream);
          });
        });
      });
    },
  };
}
