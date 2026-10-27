// ============================================================
//  SERVIDOR DE SEÑALIZACIÓN (signaling server)
//  Este servidor NO transporta los mensajes del chat.
//  Solo sirve para:
//    1) Guardar quién está conectado (nombre de cada usuario)
//    2) Hacer de "cartero" entre dos navegadores para que
//       puedan presentarse y crear la conexión WebRTC P2P.
// ============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servimos los archivos de la carpeta "public" (index.html, client.js, style.css)
app.use(express.static(path.join(__dirname, 'public')));

// Lista de usuarios conectados: socket.id -> nombre
const usuaris = new Map();

// Envía a TODOS la lista actualizada de usuarios
function enviarLlista() {
  const llista = [...usuaris].map(([id, nom]) => ({ id, nom }));
  io.emit('usuaris', llista);
}

io.on('connection', (socket) => {
  // 1) El usuario nos dice su nombre
  socket.on('entrar', (nom) => {
    nom = String(nom || '').trim().slice(0, 30) || 'Anònim';
    usuaris.set(socket.id, nom);
    enviarLlista();
  });

  // 2) Mensajes de señalización: offer, answer y candidatos ICE.
  //    El servidor no mira qué hay dentro, solo lo reenvía al destinatario "a".
  socket.on('senyal', ({ a, dades }) => {
    if (!usuaris.has(a)) return; // el destinatario ya no existe
    io.to(a).emit('senyal', { de: socket.id, dades });
  });

  // 3) Cuando alguien cierra la pestaña lo quitamos de la lista
  socket.on('disconnect', () => {
    usuaris.delete(socket.id);
    enviarLlista();
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`);
});
