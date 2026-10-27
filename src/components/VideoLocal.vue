<script setup>
import { useMedia } from '../composables/useMedia';

const emit = defineEmits(['canviar-camera']);

const {
  localStream,
  cameres,
  cameraActual,
  cameraEncesa,
  microEnces,
  avisMedia,
  commutarCamera,
  commutarMicro
} = useMedia();
</script>

<template>
  <div class="video-local">
    <!-- Reproducción local, como en webrtc.org. muted = no oírme a mí mismo -->
    <video id="localVideo" :srcObject="localStream" autoplay playsinline muted></video>

    <p v-if="avisMedia" class="ajuda">{{ avisMedia }}</p>

    <div class="controls">
      <button type="button" :disabled="!localStream" @click="commutarCamera">
        {{ cameraEncesa ? 'Apagar càmera' : 'Encendre càmera' }}
      </button>
      <button type="button" :disabled="!localStream" @click="commutarMicro">
        {{ microEnces ? 'Silenciar micro' : 'Activar micro' }}
      </button>
    </div>

    <label for="availableCameras" class="ajuda">Càmera:</label>
    <select
      id="availableCameras"
      :value="cameraActual"
      :disabled="cameres.length < 2"
      @change="emit('canviar-camera', $event.target.value)"
    >
      <option v-for="camera in cameres" :key="camera.id" :value="camera.id">
        {{ camera.nom }}
      </option>
    </select>
  </div>
</template>
