<script setup>
import { ref, computed } from 'vue';
import PantallaNom from './components/PantallaNom.vue';
import VideoLocal from './components/VideoLocal.vue';
import LlistaUsuaris from './components/LlistaUsuaris.vue';
import FinestraXat from './components/FinestraXat.vue';
import { useMedia } from './composables/useMedia';
import { useWebRTC } from './composables/useWebRTC';

const { iniciarMedia, canviarCamera } = useMedia();
const { meuId, usuaris, xatObert, xats, nomDe, entrar, obrirXat, enviar, substituirVideo } = useWebRTC();

const elMeuNom = ref('');

// La lista sin mí mismo
const altres = computed(() => usuaris.value.filter(u => u.id !== meuId.value));

// 1) Me dicen el nombre: primero abro la cámara y después entro
async function quanEntra(nom) {
  elMeuNom.value = nom;
  await iniciarMedia();
  entrar(nom);
}

// Cambiar de cámara: abro la nueva y la cambio en todas las conexiones
async function quanCanviaCamera(deviceId) {
  const nouTrack = await canviarCamera(deviceId);
  if (nouTrack) await substituirVideo(nouTrack);
}
</script>

<template>
  <!-- PANTALLA 1: pedir el nombre -->
  <PantallaNom v-if="!elMeuNom" @entrar="quanEntra" />

  <!-- PANTALLA 2: mi cámara + lista de conectados + chat -->
  <section v-else class="pantalla-xat">
    <aside class="lateral">
      <p class="jo">Ets: <strong>{{ elMeuNom }}</strong></p>

      <VideoLocal @canviar-camera="quanCanviaCamera" />

      <h2>Connectats</h2>
      <LlistaUsuaris
        :usuaris="altres"
        :xat-obert="xatObert"
        :xats="xats"
        @obrir="obrirXat"
      />
      <p class="ajuda">Clica un usuari per obrir una videotrucada i un xat P2P.</p>
    </aside>

    <FinestraXat
      v-if="xatObert"
      :nom="nomDe(xatObert)"
      :xat="xats[xatObert]"
      @enviar="enviar"
    />
    <main v-else class="xat sense-xat">
      Selecciona un usuari de la llista
    </main>
  </section>
</template>
