function record(stream, socket) {
  let recorder;

  recorder = getRecorder(stream);

  socket.emit('startSaveStream', {
    name: stream.id,
    fileExtension: 'webm',
  });

  function getRecorder(stream) {
    const _recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });

    try {
      _recorder.start(1000);
    } catch (error) {
      return;
    }

    _recorder.onerror = console.error;

    _recorder.ondataavailable = (event) => {
      console.log('saving stream');
      if (!event.data || !event.data.size) {
        return;
      }
      socket.emit('saveStream', event.data);
    };

    return _recorder;
  }

  return {
    pause() {
      recorder.pause();
    },

    resume() {
      recorder.resume();
    },

    stop() {
      if (recorder) {
        recorder.stop();
      }
      socket.emit('endSaveStream');
    },

    setStream(stream) {
      if (recorder && recorder.start !== 'inactive') {
        recorder.stop();
      }

      recorder = getRecorder(stream);
    },
  };
}
