# Xat WebRTC amb Vue

- **AEA2 Activitat 1:** xat de text P2P amb WebRTC i **Vue 3** (Composition API). La comunicació s'inicia amb WebSockets (Socket.IO).
- **AEA2 Activitat 2 (ampliació):** un cop iniciada la conversa, es pot **compartir pantalla** amb l'altre usuari.

La connexió P2P es fa amb la llibreria [SimplePeer](https://github.com/feross/simple-peer).
Projecte creat amb `npm create vue@latest` (JavaScript, sense features, projecte en blanc).

## Què fa

1. Només entrar, demana el nom.
2. Mostra el llistat de tots els connectats.
3. En clicar un usuari, s'obre un xat P2P: els missatges van pel canal de dades de SimplePeer, directament d'un navegador a l'altre.
4. Amb el xat obert, el botó **Compartir pantalla** obre el selector del navegador (pantalla, finestra o pestanya) amb `getDisplayMedia({ video: true, audio: false })`. L'stream s'afegeix a la connexió amb `peer.addStream(stream)` i l'altre usuari el veu en un `<video>`.
5. **Aturar compartició** treu l'stream (`peer.removeStream`) sense tancar el xat. També funciona si s'atura des del botó del navegador.

El servidor (Node + Express + Socket.IO) només fa de **senyalització**: guarda la llista d'usuaris i reenvia els senyals de SimplePeer. Es manté actiu tota l'estona perquè, en afegir o treure la pantalla, SimplePeer torna a negociar i envia senyals nous.

## Requisits

- Node 22.18 o més nou (el demana Vite).
- Compartir pantalla només funciona en **localhost** o amb **HTTPS**.

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
    │   └── useWebRTC.js       SimplePeer, senyalització, xat i compartir pantalla
    └── components/
        ├── PantallaNom.vue
        ├── LlistaUsuaris.vue
        └── FinestraXat.vue    xat + botó i vídeo de la pantalla compartida
```
