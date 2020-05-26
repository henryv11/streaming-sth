const player = playerController();
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
  playLocalFile(event);
};

window.onunload = window.onbeforeunload = async () => {
  onExit();
};

openWebcamButton.onclick = () => {
  webcam();
};

shareScreenButton.onclick = () => {
  shareScreen();
};

streamingButton.onclick = () => {
  if (currentBroadcast) {
    stopCurrentBroadcast();
    streamingButton.innerHTML = 'Start Screaming';
  } else {
    startBroadcast();
    if (currentBroadcast) {
      streamingButton.innerHTML = 'Stop Screaming';
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

async function webcam() {
  const stream = await getUserMedia();
  stopCurrentWatch();
  player.setVideoStream(stream);
  refreshBroadcastStream();
}

async function shareScreen() {
  const stream = await getDisplayMedia();
  stopCurrentWatch();
  player.setVideoStream(stream);
  refreshBroadcastStream();
}

function playLocalFile({
  currentTarget: {
    files: [file],
  },
}) {
  if (!file) {
    return alert('invalid file');
  }

  player.setVideoSource(URL.createObjectURL(file));
  refreshBroadcastStream();
}

function onExit() {
  if (currentBroadcast) {
    stopCurrentBroadcast();
  }
  if (currentWatch) {
    stopCurrentWatch();
  }
  socket.emit('close');
  socket.close();
}

function startBroadcast() {
  if (currentBroadcast) {
    return;
  }
  currentBroadcast = broadcast(socket, player.getStream());
}

function watchStream(id) {
  if (id === currentStreamId) {
    return;
  }

  stopCurrentWatch();
  currentStreamId = id;

  currentWatch = watch(
    id,
    socket,
    ({ streams: [stream] }) => {
      player.setVideoStream(stream);
      refreshBroadcastStream();
    },
    () => console.info('stopped watcing'),
  );

  renderBroadcasters();
}

function setVideoSourceFromServer(name) {
  stopCurrentWatch();
  player.setVideoSource(`http://localhost:8080/videos/${name}`);
  refreshBroadcastStream();
}

function refreshBroadcastStream() {
  if (!currentBroadcast) {
    return;
  }
  currentBroadcast.setStream(player.getStream());
}

function stopCurrentWatch() {
  if (!currentWatch) {
    return;
  }
  currentStreamId = undefined;
  console.debug('stopping current watch');
  currentWatch.disconnect();
  currentWatch = undefined;
}

function stopCurrentBroadcast() {
  if (!currentBroadcast) {
    return;
  }
  console.debug('stopping current broadcast');
  currentBroadcast.stop();
  currentWatch = undefined;
}

async function getUserMedia() {
  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
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

function playerController() {
  const playerContainer = document.getElementById('player-container');
  let player = createNewPlayer();

  function createNewPlayer() {
    playerContainer.innerHTML = `<video id="player" controls></video>`;
    const playerEl = document.getElementById('player');
    playerEl.onloadeddata = () => playerEl.play();
    return playerEl;
  }

  createNewPlayer();

  return {
    async setVideoSource(source) {
      console.debug('setting video source', source);
      player = createNewPlayer();

      player.src = source;
    },

    async setVideoStream(stream) {
      console.debug('setting video stream', stream);
      player = createNewPlayer();

      player.srcObject = stream;
    },

    getStream() {
      return player.captureStream();
    },
  };
}
