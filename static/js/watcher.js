function watch(id, socket, onMediaStream, onDisconnect) {
  const config = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  };

  let peerConnection;

  socket.emit('watch', id);

  socket.on('offer', (id, desc) => {
    console.debug('got offer', { id, desc });
    peerConnection = new RTCPeerConnection(config);

    peerConnection
      .setRemoteDescription(desc)
      .then(() => {
        console.debug('creating answer');
        peerConnection.createAnswer();
      })
      .then((desc) => {
        console.debug('got peerconnection local description', desc);
        peerConnection.setLocalDescription(desc);
      })
      .then(() => {
        console.debug(
          'sending answer',
          id,
          peerConnection,
          peerConnection.localDescription,
        );
        socket.emit('answer', id, peerConnection.localDescription);
      })
      .catch(console.error);

    peerConnection.ontrack = (event) => {
      console.debug('got track', event);
      onMediaStream(event);
    };

    peerConnection.onicecandidate = (event) => {
      console.debug('got icecandidate', event);
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      } else {
        console.warn('no candidate');
      }
    };
  });

  socket.on('candidate', (id, candidate) => {
    console.debug('got candidate', id, candidate);
    peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((e) => console.error(e));
  });

  socket.on('disconnectPeer', () => {
    console.debug('disconnecting from broadcaster');
    peerConnection.close();
    onDisconnect();
  });

  return {
    stop() {
      socket.emit('disconnect', id);
    },
  };
}
