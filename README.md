# Xat WebRTC

AEA2 Activitat 1: xat i videotrucada P2P amb WebRTC. La comunicació s'inicia amb WebSockets (Socket.IO).

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
npm start
```

Obre `http://localhost:3000` en dues finestres (una d'elles d'incògnit).

> Fora de `localhost`, la càmera només funciona amb **HTTPS**. Si s'obre amb `http://`, l'app funciona només amb text.

## Estructura

```
├── server.js          servidor de senyalització (Socket.IO)
└── public/
    ├── index.html     pantalla del nom + xat i vídeo
    ├── client.js      lògica WebRTC
    └── style.css      estils
```

Basat en la guia [Getting started de webrtc.org](https://webrtc.org/getting-started/media-devices).
