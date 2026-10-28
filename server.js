// ============================================================
//  SERVIDOR DE SEÑALIZACIÓN (signaling server)
//  Este servidor NO transporta los mensajes del chat.
//  Solo sirve para:
//    1) Servir la app de Vue ya compilada (carpeta "dist")
//    2) Guardar quién está conectado (nombre de cada usuario)
//    3) Hacer de "cartero" entre dos navegadores para que
//       puedan presentarse y crear la conexión WebRTC P2P.
//
//  Usa "import" (y no "require") porque el package.json que crea
//  "npm create vue" tiene "type": "module".
// ============================================================

import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 20121;

// Servimos la app de Vue compilada con "npm run build"
app.use(express.static(fileURLToPath(new URL('./dist', import.meta.url))));

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
