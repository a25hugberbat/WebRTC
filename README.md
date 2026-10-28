# Xat WebRTC amb Vue

AEA2 Activitat 1: xat de text P2P amb WebRTC i **Vue 3** (Composition API). La comunicació s'inicia amb WebSockets (Socket.IO).

Projecte creat amb `npm create vue@latest` (JavaScript, sense features, projecte en blanc).

## Què fa

1. Només entrar, demana el nom.
2. Mostra el llistat de tots els connectats.
3. En clicar un usuari, s'obre un xat P2P amb WebRTC: els missatges van per un `RTCDataChannel`, directament d'un navegador a l'altre.

El servidor (Node + Express + Socket.IO) només fa de **senyalització**: guarda la llista d'usuaris i reenvia l'oferta, la resposta i els candidats ICE.

## Requisits

Node 22.18 o més nou (el demana Vite).

## Com executar-ho

```bash
npm install
npm run build   # compila l'app de Vue a dist/
npm start       # servidor a http://localhost:20121
```

Per programar (recàrrega automàtica), en dues terminals:

```bash
npm run server  # Socket.IO al port 20121
npm run dev     # Vite al port 5173 -> obre http://localhost:5173
```

Obre l'app en dues finestres (una d'elles d'incògnit) per provar-la.

## Estructura

```
├── server.js                  servidor de senyalització (Socket.IO) + serveix dist/
├── vite.config.js             de create-vue + proxy de /socket.io en desenvolupament
├── index.html
└── src/
    ├── main.js
    ├── App.vue                les dues pantalles
    ├── socket.js              connexió Socket.IO
    ├── style.css
    ├── composables/
    │   └── useWebRTC.js       RTCPeerConnection, senyalització i DataChannel
    └── components/
        ├── PantallaNom.vue
        ├── LlistaUsuaris.vue
        └── FinestraXat.vue
```

Basat en la guia de webrtc.org: [Peer connections](https://webrtc.org/getting-started/peer-connections) i [Data channels](https://webrtc.org/getting-started/data-channels).
