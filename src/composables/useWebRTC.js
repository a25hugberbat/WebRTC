// ============================================================
//  useWebRTC: lista de conectados, conexiones P2P con SimplePeer,
//  chat de texto y compartir pantalla.
//
//  SimplePeer es una librería que envuelve RTCPeerConnection:
//   - crea la oferta, la respuesta y los candidatos ICE por nosotros
//     y nos los da en el evento 'signal' (solo hay que enviarlos al otro)
//   - trae un canal de datos ya hecho: peer.send() y evento 'data'
//   - con peer.addStream() renegocia sola para añadir vídeo
// ============================================================
import { ref, reactive, markRaw } from 'vue';
// Usamos la versión ya empaquetada para el navegador (lleva dentro lo que
// necesita de Node, como Buffer). Con 'simple-peer' a secas, Vite falla.
import SimplePeer from 'simple-peer/simplepeer.min.js';
import { socket } from '../socket';

// Servidor STUN de Google, igual que antes
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// ---------- Estado REACTIVO (lo que se ve en pantalla) ----------
const meuId = ref(socket.id || '');
const usuaris = ref([]);     // [{ id, nom }] que nos manda el servidor
const xatObert = ref(null);  // id del usuario con el que hablo ahora
// id -> { missatges, noLlegits, connectat, compartint, pantallaRemota }
const xats = reactive({});

// ---------- Estado NO reactivo ----------
// Los objetos SimplePeer NO se meten en reactive(): Vue no tiene que vigilarlos.
const peers = new Map();     // id -> peer de SimplePeer

// ============================================================
//  Ayudas
// ============================================================
function nomDe(id) {
  const u = usuaris.value.find(u => u.id === id);
  return u ? u.nom : '???';
}

// Crea (si no existe) el "xat" de un usuario
function crearXat(id) {
  if (!xats[id]) {
    xats[id] = {
      missatges: [],
      noLlegits: 0,
      connectat: false,
      compartint: null,      // MI pantalla que comparto con esta persona
      pantallaRemota: null   // la pantalla que esta persona comparte conmigo
    };
  }
  return xats[id];
}

function afegirSistema(id, text) {
  crearXat(id).missatges.push({ de: 'sistema', text });
}

// Por el canal de datos mandamos objetos en JSON, así podemos enviar
// mensajes de chat y también avisos ("he dejado de compartir").
function enviarDades(peer, objecte) {
  peer.send(JSON.stringify(objecte));
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
      tancarPeer(id);
      delete xats[id];
    }
  }
  if (xatObert.value && !xats[xatObert.value]) xatObert.value = null;
});

// ============================================================
//  2) LA CONEXIÓN CON SIMPLEPEER
//     initiator = true  -> soy yo quien hace la oferta (he hecho clic)
//     initiator = false -> espero la oferta del otro
// ============================================================
function crearPeer(id, initiator) {
  const peer = new SimplePeer({ initiator, config: configuration });
  peers.set(id, peer);
  const xat = crearXat(id);

  // SimplePeer quiere enviar algo al otro (oferta, respuesta, candidato
  // o una renegociación al añadir la pantalla): lo mandamos por Socket.IO.
  peer.on('signal', (dades) => {
    socket.emit('senyal', { a: id, dades });
  });

  // El canal de datos está abierto: ya podemos chatear
  peer.on('connect', () => {
    xat.connectat = true;
    afegirSistema(id, 'Connexió P2P establerta ✔');
  });

  // Llega algo por el canal de datos
  peer.on('data', (data) => {
    const missatge = JSON.parse(data.toString());

    if (missatge.tipus === 'text') {
      xat.missatges.push({ de: 'seu', text: missatge.text });
      if (xatObert.value !== id) xat.noLlegits++;
    } else if (missatge.tipus === 'pantalla-off') {
      xat.pantallaRemota = null;
      afegirSistema(id, nomDe(id) + ' ha deixat de compartir la pantalla');
    }
  });

  // El otro ha añadido un stream (su pantalla) con addStream
  peer.on('stream', (stream) => {
    xat.pantallaRemota = markRaw(stream);
    afegirSistema(id, nomDe(id) + ' està compartint la pantalla');
    if (xatObert.value !== id) xat.noLlegits++;
  });

  // La conexión se ha cerrado (el otro se ha ido o ha fallado)
  peer.on('close', () => {
    if (peers.get(id) === peer) tancarPeer(id);
  });

  peer.on('error', (err) => {
    console.error('Error SimplePeer:', err);
  });

  return peer;
}

function tancarPeer(id) {
  const peer = peers.get(id);
  peers.delete(id);
  if (peer && !peer.destroyed) peer.destroy();

  const xat = xats[id];
  if (!xat) return;
  if (xat.compartint) xat.compartint.getTracks().forEach(t => t.stop());
  if (xat.connectat) afegirSistema(id, 'Connexió P2P tancada');
  xat.connectat = false;
  xat.compartint = null;
  xat.pantallaRemota = null;
}

// ============================================================
//  3) SEÑALIZACIÓN: Socket.IO lleva las señales de SimplePeer.
//     Sigue activa todo el rato: al compartir pantalla, SimplePeer
//     vuelve a negociar y manda nuevas señales por aquí.
// ============================================================
socket.on('senyal', ({ de, dades }) => {
  let peer = peers.get(de);

  // Caso raro: los dos han hecho clic a la vez y los dos son "initiator".
  // Gana el id "más pequeño"; el otro tira su peer y contesta.
  if (dades.type === 'offer' && peer && peer.initiator && !xats[de]?.connectat) {
    if (socket.id < de) return;   // gano yo: ignoro su oferta
    tancarPeer(de);               // gana él
    peer = null;
  }

  if (!peer) {
    if (dades.type !== 'offer') return;   // señal suelta de una conexión vieja
    peer = crearPeer(de, false);
    afegirSistema(de, nomDe(de) + ' vol xatejar amb tu');
  }

  peer.signal(dades);   // SimplePeer hace el setRemoteDescription, addIceCandidate...
});

// ============================================================
//  4) Acciones que usan los componentes
// ============================================================
function obrirXat(id) {
  xatObert.value = id;
  crearXat(id).noLlegits = 0;
  if (!peers.has(id)) {
    crearPeer(id, true);
    afegirSistema(id, 'Connectant amb ' + nomDe(id) + '...');
  }
}

// Enviar un mensaje: va DIRECTO al otro navegador por el canal de datos
function enviar(text) {
  const id = xatObert.value;
  const peer = peers.get(id);
  if (!peer || !xats[id].connectat) return;

  enviarDades(peer, { tipus: 'text', text });   // <- ¡no pasa por el servidor!
  xats[id].missatges.push({ de: 'meu', text });
}

// Compartir pantalla con la persona del chat abierto.
// IMPORTANTE: se tiene que llamar desde el clic de un botón.
async function compartirPantalla() {
  const id = xatObert.value;
  const peer = peers.get(id);
  const xat = xats[id];
  if (!peer || !xat.connectat || xat.compartint) return;

  let stream;
  try {
    // El navegador enseña la ventanita para elegir pantalla, ventana o pestaña
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
  } catch (e) {
    // NotAllowedError = has pulsado "Cancelar"
    afegirSistema(id, 'No s\'ha compartit la pantalla (' + e.name + ')');
    return;
  }

  // Si mientras elegías se ha cerrado la conexión, no hacemos nada
  if (peers.get(id) !== peer || !xat.connectat) {
    stream.getTracks().forEach(t => t.stop());
    return;
  }

  xat.compartint = markRaw(stream);
  peer.addStream(stream);    // SimplePeer renegocia y al otro le salta 'stream'
  afegirSistema(id, 'Estàs compartint la pantalla');

  // Si paras con el botón del navegador ("Dejar de compartir"),
  // la pista se acaba: hacemos lo mismo que con nuestro botón.
  stream.getVideoTracks()[0].addEventListener('ended', () => aturarPantalla(id));
}

// Dejar de compartir SIN cerrar el chat
function aturarPantalla(id = xatObert.value) {
  const xat = xats[id];
  const stream = xat && xat.compartint;
  if (!stream) return;

  const peer = peers.get(id);
  if (peer && !peer.destroyed) {
    peer.removeStream(stream);                    // quita el vídeo de la conexión
    enviarDades(peer, { tipus: 'pantalla-off' }); // avisa al otro
  }
  stream.getTracks().forEach(t => t.stop());      // apaga la captura
  xat.compartint = null;
  afegirSistema(id, 'Has deixat de compartir la pantalla');
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
    enviar,
    compartirPantalla,
    aturarPantalla
  };
}
