function watch(id, socket, onMediaStream, onDisconnect) {
  const config = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  };
  let isOfferAccepted = false;

  let peerConnection;

  socket.emit('watch', id);

  socket.on('offer', (id, desc) => {
    if (isOfferAccepted) {
      return;
    }
    console.debug('got offer', { id, desc });

    isOfferAccepted = true;
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
      if (event.candidate) {
        console.debug('got icecandidate from peer', event);
        socket.emit('candidate', id, event.candidate);
      } else {
        console.warn('no candidate');
      }
    };
  });

  socket.on('candidate', (id, candidate) => {
    console.debug('got candidate from server', id, candidate);
    if (peerConnection.signalingState === 'closed') {
      console.debug('signaling state is closed');
      return;
    }
    peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((e) => console.error(e));
  });

  // socket.on('disconnectPeer', () => {});

  return {
    disconnect() {
      socket.emit('disconnectPeer', id);
      peerConnection.close();
      onDisconnect && onDisconnect();
    },
  };
}
