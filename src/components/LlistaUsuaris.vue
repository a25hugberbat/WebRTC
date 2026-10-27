<script setup>
defineProps({
  usuaris: Array,     // [{ id, nom }] sin mí
  xatObert: String,   // id del chat abierto (o null)
  xats: Object        // id -> { connectat, noLlegits, ... }
});

defineEmits(['obrir']);
</script>

<template>
  <ul class="llista-usuaris">
    <li v-if="usuaris.length === 0" class="buit">Ningú més connectat...</li>

    <li
      v-for="u in usuaris"
      :key="u.id"
      :class="{ actiu: u.id === xatObert, p2p: xats[u.id]?.connectat }"
      @click="$emit('obrir', u.id)"
    >
      {{ u.nom }}
      <span v-if="xats[u.id]?.noLlegits" class="badge">{{ xats[u.id].noLlegits }}</span>
    </li>
  </ul>
</template>
