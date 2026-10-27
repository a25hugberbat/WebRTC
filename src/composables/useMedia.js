// ============================================================
//  useMedia: cámara y micro
//  Basado en https://webrtc.org/getting-started/media-devices
//
//  El estado está FUERA de la función useMedia(), así todos los
//  componentes que llamen a useMedia() comparten la misma cámara.
// ============================================================
import { ref, shallowRef } from 'vue';

// shallowRef: Vue no se mete DENTRO del MediaStream (es un objeto del
// navegador y no hace falta que sea reactivo por dentro)
const localStream = shallowRef(null);
const cameres = ref([]);          // [{ id, nom }]
const cameraActual = ref('');     // deviceId de la cámara que uso
const cameraEncesa = ref(true);
const microEnces = ref(true);
const avisMedia = ref('');        // mensaje si no hay cámara

// Igual que en la guía: abrir cámara/micro con unas "constraints"
async function openMediaDevices(constraints) {
  return await navigator.mediaDevices.getUserMedia(constraints);
}

// Igual que en la guía: devuelve los dispositivos de un tipo
async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === type);
}

async function actualitzarLlistaCameres() {
  const llista = await getConnectedDevices('videoinput');
  cameres.value = llista.map((camera, i) => ({
    id: camera.deviceId,
    nom: camera.label || 'Càmera ' + (i + 1)
  }));

  const track = localStream.value ? localStream.value.getVideoTracks()[0] : null;
  cameraActual.value = track ? track.getSettings().deviceId : '';
}

async function iniciarMedia() {
  // getUserMedia solo existe en HTTPS o en localhost
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    avisMedia.value = 'Aquest navegador no deixa usar la càmera (cal HTTPS). Només xat de text.';
    return;
  }

  try {
    localStream.value = await openMediaDevices({ video: true, audio: true });
    avisMedia.value = '';

    await actualitzarLlistaCameres();
    // Si conectas o desconectas una cámara, actualizamos la lista
    navigator.mediaDevices.addEventListener('devicechange', actualitzarLlistaCameres);
  } catch (error) {
    console.error('Error accessing media devices.', error);
    avisMedia.value = 'Sense càmera: només xat de text.';
  }
}

// Abre otra cámara y devuelve su pista de vídeo (track).
// Quien la llame tiene que cambiarla también en las conexiones.
async function canviarCamera(deviceId) {
  try {
    const nouStream = await openMediaDevices({ video: { deviceId: { exact: deviceId } } });
    const nouTrack = nouStream.getVideoTracks()[0];
    nouTrack.enabled = cameraEncesa.value;

    const vellTrack = localStream.value.getVideoTracks()[0];
    if (vellTrack) vellTrack.stop();               // apagamos la cámara vieja

    // Stream nuevo = vídeo nuevo + el mismo audio de antes
    localStream.value = new MediaStream([nouTrack, ...localStream.value.getAudioTracks()]);
    cameraActual.value = deviceId;
    return nouTrack;
  } catch (error) {
    console.error('Error opening video camera.', error);
    return null;
  }
}

// enabled = false -> se envía negro (vídeo) o silencio (audio)
function commutarCamera() {
  const track = localStream.value && localStream.value.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  cameraEncesa.value = track.enabled;
}

function commutarMicro() {
  const track = localStream.value && localStream.value.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  microEnces.value = track.enabled;
}

export function useMedia() {
  return {
    localStream,
    cameres,
    cameraActual,
    cameraEncesa,
    microEnces,
    avisMedia,
    iniciarMedia,
    canviarCamera,
    commutarCamera,
    commutarMicro
  };
}
