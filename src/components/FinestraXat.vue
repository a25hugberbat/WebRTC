<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  nom: String,   // nombre de la otra persona
  xat: Object    // { missatges, noLlegits, connectat, compartint, pantallaRemota }
});

const emit = defineEmits(['enviar', 'compartir', 'aturar']);

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
    <header class="cap-xat">
      <span>Xat P2P amb {{ nom }}</span>

      <!-- Botón de compartir / dejar de compartir pantalla -->
      <button
        v-if="!xat.compartint"
        type="button"
        class="boto-pantalla"
        :disabled="!xat.connectat"
        @click="emit('compartir')"
      >
        Compartir pantalla
      </button>
      <button
        v-else
        type="button"
        class="boto-pantalla aturar"
        @click="emit('aturar')"
      >
        Aturar compartició
      </button>
    </header>

    <!-- La pantalla que comparte la otra persona -->
    <div v-if="xat.pantallaRemota" class="zona-pantalla">
      <p class="etiqueta">Pantalla de {{ nom }}</p>
      <video
        id="pantallaRemota"
        :srcObject="xat.pantallaRemota"
        autoplay
        playsinline
        muted
      ></video>
    </div>

    <!-- Lo que estoy compartiendo yo (vista previa pequeña) -->
    <div v-if="xat.compartint" class="previa">
      <p class="etiqueta">Estàs compartint:</p>
      <video id="pantallaMeva" :srcObject="xat.compartint" autoplay playsinline muted></video>
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
