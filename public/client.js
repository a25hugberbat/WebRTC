// ============================================================
//  CLIENTE: videollamada + chat P2P con WebRTC
//  Basado en la guía https://webrtc.org/getting-started/
//
//   - Socket.IO -> solo señalización (presentarse)
//   - getUserMedia -> abrir cámara y micro (Media devices)
//   - RTCPeerConnection -> conexión P2P (Peer connections)
//   - addTrack / evento 'track' -> vídeo y audio (Remote streams)
//   - RTCDataChannel -> mensajes de texto (Data channels)
// ============================================================

const socket = io();

// Configuración igual que en la guía de webrtc.org (servidor STUN de Google)
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ---------- Elementos del HTML ----------
const pantallaNom = document.getElementById('pantallaNom');
const pantallaXat = document.getElementById('pantallaXat');
const formNom = document.getElementById('formNom');
const inputNom = document.getElementById('inputNom');
const elMeuNom = document.getElementById('elMeuNom');
const llistaUsuaris = document.getElementById('llistaUsuaris');
const capXat = document.getElementById('capXat');
const ulMissatges = document.getElementById('missatges');
const formMissatge = document.getElementById('formMissatge');
const inputMissatge = document.getElementById('inputMissatge');
const botoEnviar = document.getElementById('botoEnviar');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const zonaVideo = document.getElementById('zonaVideo');
const estatMedia = document.getElementById('estatMedia');
const botoCamera = document.getElementById('botoCamera');
const botoMicro = document.getElementById('botoMicro');
const selectCameres = document.getElementById('availableCameras');

// ---------- Estado ----------
let localStream = null;       // mi cámara y micro (MediaStream)
let usuaris = [];             // [{ id, nom }] que nos manda el servidor
let xatObert = null;          // id del usuario con el que hablo ahora
const connexions = new Map(); // idUsuari -> { pc, canal, streamRemot, missatges, noLlegits, cua }

// ============================================================
//  1) PEDIR EL NOMBRE (y abrir la cámara)
// ============================================================
formNom.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nom = inputNom.value.trim();
  if (!nom) return;

  elMeuNom.textContent = nom;
  pantallaNom.classList.add('oculta');
  pantallaXat.classList.remove('oculta');

  // Primero abrimos la cámara, así las conexiones ya nacen con vídeo
  await iniciarMedia();
  socket.emit('entrar', nom);
});

// ============================================================
//  2) MEDIA DEVICES: cámara y micro
//     (https://webrtc.org/getting-started/media-devices)
// ============================================================
async function openMediaDevices(constraints) {
  return await navigator.mediaDevices.getUserMedia(constraints);
}

async function iniciarMedia() {
  // getUserMedia solo existe en HTTPS o en localhost
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    estatMedia.textContent = 'Aquest navegador no deixa usar la càmera (cal HTTPS). Només xat de text.';
    return;
  }

  try {
    localStream = await openMediaDevices({ video: true, audio: true });
    localVideo.srcObject = localStream;          // reproducción local
    estatMedia.textContent = '';
    botoCamera.disabled = false;
    botoMicro.disabled = false;

    await actualitzarLlistaCameres();
    // Si conectas o desconectas una cámara, actualizamos la lista
    navigator.mediaDevices.addEventListener('devicechange', actualitzarLlistaCameres);
  } catch (error) {
    console.error('Error accessing media devices.', error);
    estatMedia.textContent = 'Sense càmera: només xat de text.';
  }
}

// Devuelve los dispositivos de un tipo ('videoinput', 'audioinput'...)
async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === type);
}

// Rellena el <select> con las cámaras disponibles
async function actualitzarLlistaCameres() {
  const cameres = await getConnectedDevices('videoinput');
  const trackActual = localStream ? localStream.getVideoTracks()[0] : null;
  const idActual = trackActual ? trackActual.getSettings().deviceId : '';

  selectCameres.innerHTML = '';
  cameres.forEach((camera, i) => {
    const opcio = document.createElement('option');
    opcio.value = camera.deviceId;
    opcio.textContent = camera.label || 'Càmera ' + (i + 1);
    if (camera.deviceId === idActual) opcio.selected = true;
    selectCameres.appendChild(opcio);
  });
  selectCameres.disabled = cameres.length < 2;
}

// Cambiar de cámara: abrimos la nueva y la cambiamos en TODAS las conexiones
selectCameres.addEventListener('change', async () => {
  try {
    const nouStream = await openMediaDevices({ video: { deviceId: { exact: selectCameres.value } } });
    const nouTrack = nouStream.getVideoTracks()[0];
    const vellTrack = localStream.getVideoTracks()[0];
    if (vellTrack) nouTrack.enabled = vellTrack.enabled;

    // replaceTrack cambia el vídeo que enviamos sin tener que renegociar
    for (const c of connexions.values()) {
      const sender = c.pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(nouTrack);
    }

    if (vellTrack) {
      localStream.removeTrack(vellTrack);
      vellTrack.stop();                      // apagamos la cámara vieja
    }
    localStream.addTrack(nouTrack);
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('Error opening video camera.', error);
  }
});

// Apagar/encender cámara y micro: enabled = false envía negro / silencio
botoCamera.addEventListener('click', () => {
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  botoCamera.textContent = track.enabled ? 'Apagar càmera' : 'Encendre càmera';
});

botoMicro.addEventListener('click', () => {
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  botoMicro.textContent = track.enabled ? 'Silenciar micro' : 'Activar micro';
});

// ============================================================
//  3) LISTA DE CONECTADOS
// ============================================================
socket.on('usuaris', (llista) => {
  usuaris = llista;

  // Si alguien se ha ido, cerramos su conexión P2P
  for (const id of [...connexions.keys()]) {
    if (!usuaris.some(u => u.id === id)) tancarConnexio(id);
  }
  if (xatObert && !usuaris.some(u => u.id === xatObert)) {
    xatObert = null;
    pintarXat();
  }
  pintarLlista();
});

function nomDe(id) {
  const u = usuaris.find(u => u.id === id);
  return u ? u.nom : '???';
}

function pintarLlista() {
  llistaUsuaris.innerHTML = '';
  const altres = usuaris.filter(u => u.id !== socket.id); // no me muestro a mí mismo

  if (altres.length === 0) {
    const li = document.createElement('li');
    li.className = 'buit';
    li.textContent = 'Ningú més connectat...';
    llistaUsuaris.appendChild(li);
    return;
  }

  for (const u of altres) {
    const li = document.createElement('li');
    li.textContent = u.nom;
    if (u.id === xatObert) li.classList.add('actiu');

    const c = connexions.get(u.id);
    if (c && c.canal && c.canal.readyState === 'open') li.classList.add('p2p');
    if (c && c.noLlegits > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c.noLlegits;
      li.appendChild(badge);
    }

    li.addEventListener('click', () => obrirXat(u.id));
    llistaUsuaris.appendChild(li);
  }
}

// ============================================================
//  4) PEER CONNECTION: crear la conexión WebRTC
//     (https://webrtc.org/getting-started/peer-connections)
// ============================================================
function crearConnexio(id) {
  if (connexions.has(id)) return connexions.get(id);

  const peerConnection = new RTCPeerConnection(configuration);
  const c = {
    pc: peerConnection,
    canal: null,
    streamRemot: null,
    missatges: [],
    noLlegits: 0,
    cua: Promise.resolve()
  };
  connexions.set(id, c);

  // Remote streams: enviamos cada pista (vídeo y audio) de mi cámara
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Remote streams: recibimos el vídeo y el audio del otro
  peerConnection.addEventListener('track', (event) => {
    const [remoteStream] = event.streams;
    c.streamRemot = remoteStream || new MediaStream([event.track]);
    if (id === xatObert) mostrarVideoRemot();
  });

  // Trickle ICE: cada candidato que encontramos se lo mandamos al otro
  peerConnection.addEventListener('icecandidate', (event) => {
    if (event.candidate) enviarSenyal(id, { tipus: 'candidate', candidate: event.candidate });
  });

  // Data channels: si es el OTRO quien ha creado el canal, nos llega aquí
  peerConnection.addEventListener('datachannel', (event) => prepararCanal(id, event.channel));

  // Estado de la conexión
  peerConnection.addEventListener('connectionstatechange', () => {
    if (['failed', 'closed'].includes(peerConnection.connectionState)) {
      afegirSistema(id, 'Connexió P2P perduda');
      tancarConnexio(id);
      pintarLlista();
      if (id === xatObert) mostrarVideoRemot();
    }
  });

  return c;
}

// Data channels: el "tubo" por donde viajan los mensajes de texto
// (https://webrtc.org/getting-started/data-channels)
function prepararCanal(id, canal) {
  const c = connexions.get(id);
  c.canal = canal;

  canal.addEventListener('open', () => {
    afegirSistema(id, 'Connexió P2P establerta ✔');
    pintarLlista();
    if (id === xatObert) activarInput(true);
  });

  canal.addEventListener('message', (event) => {
    c.missatges.push({ de: id, text: event.data });
    if (id === xatObert) pintarXat();
    else c.noLlegits++;
    pintarLlista();
  });

  canal.addEventListener('close', () => {
    if (id === xatObert) activarInput(false);
    pintarLlista();
  });
}

// Yo hago clic en un usuario -> YO llamo (makeCall en la guía)
async function makeCall(id) {
  const c = crearConnexio(id);

  // Si no tengo cámara, igualmente quiero RECIBIR el vídeo del otro
  if (!localStream) {
    c.pc.addTransceiver('video', { direction: 'recvonly' });
    c.pc.addTransceiver('audio', { direction: 'recvonly' });
  }

  const canal = c.pc.createDataChannel('xat');
  prepararCanal(id, canal);

  const offer = await c.pc.createOffer();
  await c.pc.setLocalDescription(offer);
  enviarSenyal(id, { tipus: 'offer', sdp: c.pc.localDescription });
  afegirSistema(id, 'Trucant a ' + nomDe(id) + '...');
}

// ============================================================
//  5) SEÑALIZACIÓN: el "signalingChannel" de la guía es Socket.IO
// ============================================================
function enviarSenyal(a, dades) {
  socket.emit('senyal', { a, dades });
}

socket.on('senyal', ({ de, dades }) => {
  let c = connexions.get(de);

  // Caso raro: los dos han llamado a la vez. Gana el id "más pequeño".
  if (dades.tipus === 'offer' && c && c.pc.signalingState === 'have-local-offer') {
    if (socket.id < de) return;   // gano yo: ignoro su oferta
    tancarConnexio(de);           // gana él: tiro la mía
    c = null;
  }

  if (!c) c = crearConnexio(de);
  // Procesamos los mensajes de cada usuario EN ORDEN (cola de promesas)
  c.cua = c.cua.then(() => processarSenyal(de, dades)).catch(err => console.error(err));
});

async function processarSenyal(de, dades) {
  const c = connexions.get(de);
  if (!c) return;
  const peerConnection = c.pc;

  if (dades.tipus === 'offer') {
    // Me llaman -> acepto y contesto con una RESPUESTA
    await peerConnection.setRemoteDescription(new RTCSessionDescription(dades.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    enviarSenyal(de, { tipus: 'answer', sdp: peerConnection.localDescription });
    afegirSistema(de, nomDe(de) + ' et truca');
    pintarLlista();

  } else if (dades.tipus === 'answer') {
    // El otro ha aceptado mi llamada
    await peerConnection.setRemoteDescription(new RTCSessionDescription(dades.sdp));

  } else if (dades.tipus === 'candidate') {
    // Un posible camino para llegar al otro
    try {
      await peerConnection.addIceCandidate(dades.candidate);
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  }
}

function tancarConnexio(id) {
  const c = connexions.get(id);
  if (!c) return;
  if (c.canal) c.canal.close();
  c.pc.close();
  connexions.delete(id);
  if (id === xatObert) activarInput(false);
}

// ============================================================
//  6) INTERFAZ: vídeo remoto y chat
// ============================================================
function obrirXat(id) {
  xatObert = id;
  if (!connexions.has(id)) makeCall(id);

  const c = connexions.get(id);
  if (c) c.noLlegits = 0;

  pintarLlista();
  pintarXat();
}

// Muestra el vídeo de la persona con la que tengo el chat abierto
function mostrarVideoRemot() {
  const c = xatObert ? connexions.get(xatObert) : null;
  const stream = c ? c.streamRemot : null;

  if (!stream) {
    zonaVideo.classList.add('oculta');
    remoteVideo.srcObject = null;
    return;
  }
  if (remoteVideo.srcObject !== stream) {
    remoteVideo.srcObject = stream;
    remoteVideo.play().catch(() => {});
  }
  zonaVideo.classList.remove('oculta');
}

function afegirSistema(id, text) {
  const c = connexions.get(id);
  if (!c) return;
  c.missatges.push({ de: 'sistema', text });
  if (id === xatObert) pintarXat();
}

function pintarXat() {
  ulMissatges.innerHTML = '';
  mostrarVideoRemot();

  if (!xatObert) {
    capXat.textContent = 'Selecciona un usuari de la llista';
    activarInput(false);
    return;
  }

  capXat.textContent = 'Videotrucada P2P amb ' + nomDe(xatObert);
  const c = connexions.get(xatObert);
  if (!c) return;

  for (const m of c.missatges) {
    const li = document.createElement('li');
    if (m.de === 'sistema') li.className = 'sistema';
    else if (m.de === 'jo') li.className = 'meu';
    else li.className = 'seu';
    li.textContent = m.text;   // textContent = seguro, no ejecuta HTML
    ulMissatges.appendChild(li);
  }
  ulMissatges.scrollTop = ulMissatges.scrollHeight;

  activarInput(c.canal && c.canal.readyState === 'open');
}

function activarInput(actiu) {
  inputMissatge.disabled = !actiu;
  botoEnviar.disabled = !actiu;
  if (actiu) inputMissatge.focus();
}

// Enviar un mensaje: va DIRECTO al otro navegador por el DataChannel
formMissatge.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = inputMissatge.value.trim();
  const c = connexions.get(xatObert);
  if (!text || !c || !c.canal || c.canal.readyState !== 'open') return;

  c.canal.send(text);                       // <- ¡aquí NO pasa por el servidor!
  c.missatges.push({ de: 'jo', text });
  inputMissatge.value = '';
  pintarXat();
});
