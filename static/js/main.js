const player = document.getElementById('player');
const openWebcamButton = document.getElementById('open-webcam');
const shareScreenButton = document.getElementById('share-screen');
const streamingButton = document.getElementById('start-stream');
const fileInput = document.getElementById('file-input');
const availableVideosChildren = document.getElementById('available-videos');
const availableBroadcastersChildren = document.getElementById(
  'available-broadcasters',
);
const socket = io.connect('/');

let broadcasters = {};
let currentBroadcast;
let currentWatch;
let currentStreamId;

socket.on('availableVideos', (videos) => {
  availableVideosChildren.innerHTML = videos
    .map(
      (video) =>
        `<div class="video-card" onclick="setVideoSourceFromServer('${video}')">${video}</div>`,
    )
    .join('');
});

socket.on('availableBroadcasters', (bc) => {
  broadcasters = bc;
  renderBroadcasters();
});

fileInput.onchange = (event) => {
  const [file] = event.currentTarget.files;

  if (!file) {
    return alert('invalid file');
  }

  setVideoSource(URL.createObjectURL(file));
};

window.onunload = window.onbeforeunload = () => {
  stopCurrentPlayback();
  if (currentBroadcast) {
    stopCurrentBroadcast();
  }
  if (currentWatch) {
    stopCurrentWatch();
  }
  socket.emit('close');
  socket.close();
};

openWebcamButton.onclick = () => {
  getUserMedia().then(setPlaybackStream);
};

shareScreenButton.onclick = () => {
  getDisplayMedia().then(setPlaybackStream);
};

streamingButton.onclick = async () => {
  if (currentBroadcast) {
    await stopCurrentBroadcast();
    streamingButton.innerHTML = 'Start Streaming';
  } else {
    try {
      currentBroadcast = broadcast(socket, player.captureStream());
      streamingButton.innerHTML = 'Stop Streaming';
    } catch (error) {
      alert(error.message);
    }
  }
};

function renderBroadcasters() {
  availableBroadcastersChildren.innerHTML = Object.keys(broadcasters)
    .filter((key) => key !== socket.id)
    .map(
      (bc) =>
        `<div class="video-card" onclick="watchStream('${bc}')" class="${
          bc === currentStreamId ? 'active' : ''
        }">${bc}</div>`,
    )
    .join('');
}

async function watchStream(id) {
  if (id === currentStreamId) {
    return;
  }

  currentStreamId = id;

  if (currentWatch) {
    await stopCurrentWatch();
  }

  currentWatch = watch(
    id,
    socket,
    (event) => {
      setPlaybackStream(event.streams[0]);
    },
    () => console.info('stopped watcing'),
  );

  renderBroadcasters();
}

async function getUserMedia() {
  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
}

async function setVideoSourceFromServer(name) {
  return await setVideoSource(`http://localhost:8080/videos/${name}`);
}

async function setVideoSource(source) {
  await stopCurrentPlayback();
  player.src = source;
  try {
    await player.play();
  } catch (error) {
    console.error(error);
  }
  if (currentBroadcast) {
    currentBroadcast.setStream(player.captureStream());
  }
}

async function setPlaybackStream(stream) {
  if (!stream) {
    return;
  }
  await stopCurrentPlayback();
  player.srcObject = stream;
  try {
    await player.play();
  } catch (error) {
    console.error(error);
  }
  if (currentBroadcast) {
    currentBroadcast.setStream(player.captureStream());
  }
}

async function stopCurrentWatch() {
  if (!currentWatch) {
    return;
  }
  currentWatch.stop();
  currentWatch = undefined;
}

async function stopCurrentBroadcast() {
  if (!currentBroadcast) {
    return;
  }
  currentBroadcast.stop();
  currentWatch = undefined;
}

async function stopCurrentPlayback() {
  if (currentWatch) {
    stopCurrentWatch();
  }

  try {
    await player.pause();
  } catch (error) {
    console.error(error);
  }

  player.removeAttribute('src');
  player.removeAttribute('srcObject');
  await player.load();
}

async function getDisplayMedia() {
  if (navigator.getDisplayMedia) {
    return await navigator.getDisplayMedia({ video: true });
  } else if (navigator.mediaDevices.getDisplayMedia) {
    return await navigator.mediaDevices.getDisplayMedia({ video: true });
  } else {
    return await navigator.mediaDevices.getUserMedia({
      video: { mediaSource: 'screen' },
    });
  }
}
