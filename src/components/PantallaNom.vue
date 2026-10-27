<script setup>
import { ref } from 'vue';

const emit = defineEmits(['entrar']);
const nom = ref('');

function enviarNom() {
  const net = nom.value.trim();
  if (!net) return;
  emit('entrar', net);
}
</script>

<template>
  <section class="targeta">
    <h1>Xat P2P amb WebRTC</h1>
    <form @submit.prevent="enviarNom">
      <label for="inputNom">Com et dius?</label>
      <input
        id="inputNom"
        v-model="nom"
        type="text"
        maxlength="30"
        placeholder="El teu nom"
        autocomplete="off"
        required
      >
      <button type="submit">Entrar</button>
    </form>
  </section>
</template>
