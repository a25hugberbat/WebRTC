# Xat WebRTC amb Vue

AEA2 Activitat 1: xat i videotrucada P2P amb WebRTC i **Vue 3** (Composition API). La comunicació s'inicia amb WebSockets (Socket.IO).

## Què fa

1. Només entrar, demana el nom.
2. Mostra el llistat de tots els connectats.
3. En clicar un usuari, s'obre una connexió P2P amb WebRTC:
   - vídeo i àudio amb `getUserMedia` + `addTrack`
   - missatges de text amb un `RTCDataChannel`

El servidor (Node + Express + Socket.IO) només fa de **senyalització**: guarda la llista d'usuaris i reenvia l'oferta, la resposta i els candidats ICE. Els missatges i el vídeo van directament d'un navegador a l'altre.

## Com executar-ho

```bash
npm install
npm run build   # compila l'app de Vue a dist/
npm start       # servidor a http://localhost:3000
```

Per programar (recàrrega automàtica), en dues terminals:

```bash
npm run server  # Socket.IO al port 3000
npm run dev     # Vite al port 5173 -> obre http://localhost:5173
```

Obre l'app en dues finestres (una d'elles d'incògnit) per provar-la.

> Fora de `localhost`, la càmera només funciona amb **HTTPS**. Si s'obre amb `http://`, l'app funciona només amb text.

## Estructura

```
├── server.js                  servidor de senyalització (Socket.IO) + serveix dist/
├── vite.config.mjs            Vite + proxy de /socket.io en desenvolupament
├── index.html
└── src/
    ├── main.js
    ├── App.vue                les dues pantalles
    ├── socket.js              connexió Socket.IO
    ├── style.css
    ├── composables/
    │   ├── useMedia.js        càmera i micro (getUserMedia, enumerateDevices)
    │   └── useWebRTC.js       RTCPeerConnection, senyalització i DataChannel
    └── components/
        ├── PantallaNom.vue
        ├── VideoLocal.vue
        ├── LlistaUsuaris.vue
        └── FinestraXat.vue
```

Basat en la guia [Getting started de webrtc.org](https://webrtc.org/getting-started/media-devices).
