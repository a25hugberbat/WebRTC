<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  nom: String,   // nombre de la otra persona
  xat: Object    // { missatges, noLlegits, connectat, stream }
});

const emit = defineEmits(['enviar']);

const text = ref('');
const llista = ref(null);   // el <ul> de los mensajes

function enviarMissatge() {
  const net = text.value.trim();
  if (!net) return;
  emit('enviar', net);
  text.value = '';
}

// Cada vez que hay un mensaje nuevo, bajamos el scroll al final.
// flush: 'post' = espera a que Vue haya pintado el mensaje nuevo
watch(
  () => props.xat.missatges.length,
  () => {
    if (llista.value) llista.value.scrollTop = llista.value.scrollHeight;
  },
  { flush: 'post' }
);
</script>

<template>
  <main class="xat">
    <header class="cap-xat">Videotrucada P2P amb {{ nom }}</header>

    <!-- Vídeo de la otra persona (solo si nos llega) -->
    <div v-if="xat.stream" class="zona-video">
      <video id="remoteVideo" :srcObject="xat.stream" autoplay playsinline></video>
    </div>

    <ul ref="llista" class="missatges">
      <li v-for="(m, i) in xat.missatges" :key="i" :class="m.de">{{ m.text }}</li>
    </ul>

    <form class="form-missatge" @submit.prevent="enviarMissatge">
      <input
        v-model="text"
        type="text"
        placeholder="Escriu un missatge..."
        autocomplete="off"
        :disabled="!xat.connectat"
      >
      <button type="submit" :disabled="!xat.connectat">Enviar</button>
    </form>
  </main>
</template>
