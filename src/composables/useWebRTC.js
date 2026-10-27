// ============================================================
//  useWebRTC: lista de conectados, conexiones P2P y chat de texto
//  Basado en la guía https://webrtc.org/getting-started/
//   - Peer connections  -> RTCPeerConnection, offer/answer, ICE
//   - Data channels     -> mensajes de texto
// ============================================================
import { ref, reactive } from 'vue';
import { socket } from '../socket';

// Configuración igual que en la guía (servidor STUN de Google)
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ---------- Estado REACTIVO (lo que se ve en pantalla) ----------
const meuId = ref(socket.id || '');
const usuaris = ref([]);     // [{ id, nom }] que nos manda el servidor
const xatObert = ref(null);  // id del usuario con el que hablo ahora
const xats = reactive({});   // id -> { missatges, noLlegits, connectat }

// ---------- Estado NO reactivo (objetos de WebRTC) ----------
// Las RTCPeerConnection NO se meten en reactive(): son objetos del
// navegador y Vue no necesita vigilarlos.
const connexions = new Map(); // id -> { pc, canal, cua }

// ============================================================
//  Ayudas
// ============================================================
function nomDe(id) {
  const u = usuaris.value.find(u => u.id === id);
  return u ? u.nom : '???';
}

// Crea (si no existe) el "xat" de un usuario: sus mensajes
function crearXat(id) {
  if (!xats[id]) {
    xats[id] = { missatges: [], noLlegits: 0, connectat: false };
  }
  return xats[id];
}

function afegirSistema(id, text) {
  crearXat(id).missatges.push({ de: 'sistema', text });
}

// ============================================================
//  1) Entrar y lista de conectados
// ============================================================
function entrar(nom) {
  socket.emit('entrar', nom);
}

socket.on('connect', () => {
  meuId.value = socket.id;
});

socket.on('usuaris', (llista) => {
  usuaris.value = llista;

  // Si alguien se ha ido, cerramos su conexión y borramos su chat
  for (const id of Object.keys(xats)) {
    if (!llista.some(u => u.id === id)) {
      tancarConnexio(id);
      delete xats[id];
    }
  }
  if (xatObert.value && !xats[xatObert.value]) xatObert.value = null;
});

// ============================================================
//  2) PEER CONNECTION
// ============================================================
function crearConnexio(id) {
  if (connexions.has(id)) return connexions.get(id);

  const peerConnection = new RTCPeerConnection(configuration);
  const c = { pc: peerConnection, canal: null, cua: Promise.resolve() };
  connexions.set(id, c);
  crearXat(id);

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
    }
  });

  return c;
}

// Data channels: el "tubo" por donde viajan los mensajes de texto
function prepararCanal(id, canal) {
  const c = connexions.get(id);
  c.canal = canal;
  const xat = crearXat(id);

  canal.addEventListener('open', () => {
    xat.connectat = true;
    afegirSistema(id, 'Connexió P2P establerta ✔');
  });

  canal.addEventListener('message', (event) => {
    xat.missatges.push({ de: 'seu', text: event.data });
    if (xatObert.value !== id) xat.noLlegits++;
  });

  canal.addEventListener('close', () => {
    // Solo si este sigue siendo el canal actual de ese usuario
    const actual = connexions.get(id);
    if (!actual || actual.canal === canal) xat.connectat = false;
  });
}

// Yo hago clic en un usuario -> YO llamo (makeCall en la guía)
async function makeCall(id) {
  const c = crearConnexio(id);
  prepararCanal(id, c.pc.createDataChannel('xat'));

  const offer = await c.pc.createOffer();
  await c.pc.setLocalDescription(offer);
  enviarSenyal(id, { tipus: 'offer', sdp: c.pc.localDescription });
  afegirSistema(id, 'Connectant amb ' + nomDe(id) + '...');
}

function tancarConnexio(id) {
  const c = connexions.get(id);
  if (!c) return;
  if (c.canal) c.canal.close();
  c.pc.close();
  connexions.delete(id);
  if (xats[id]) xats[id].connectat = false;
}

// ============================================================
//  3) SEÑALIZACIÓN: el "signalingChannel" de la guía es Socket.IO
// ============================================================
function enviarSenyal(a, dades) {
  socket.emit('senyal', { a, dades });
}

socket.on('senyal', ({ de, dades }) => {
  let c = connexions.get(de);

  // Caso raro: los dos han hecho clic a la vez. Gana el id "más pequeño".
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
    // Me ofrecen conectar -> acepto y contesto con una RESPUESTA
    await peerConnection.setRemoteDescription(new RTCSessionDescription(dades.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    enviarSenyal(de, { tipus: 'answer', sdp: peerConnection.localDescription });
    afegirSistema(de, nomDe(de) + ' vol xatejar amb tu');

  } else if (dades.tipus === 'answer') {
    // El otro ha aceptado mi oferta
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

// ============================================================
//  4) Acciones que usan los componentes
// ============================================================
function obrirXat(id) {
  xatObert.value = id;
  crearXat(id).noLlegits = 0;
  if (!connexions.has(id)) makeCall(id);
}

// Enviar un mensaje: va DIRECTO al otro navegador por el DataChannel
function enviar(text) {
  const id = xatObert.value;
  const c = connexions.get(id);
  if (!c || !c.canal || c.canal.readyState !== 'open') return;

  c.canal.send(text);                 // <- ¡aquí NO pasa por el servidor!
  xats[id].missatges.push({ de: 'meu', text });
}

export function useWebRTC() {
  return {
    meuId,
    usuaris,
    xatObert,
    xats,
    nomDe,
    entrar,
    obrirXat,
    enviar
  };
}
