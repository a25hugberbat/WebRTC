// Una sola conexión de Socket.IO para toda la app.
// Socket.IO hace de "signalingChannel" (como lo llama la guía de webrtc.org).
import { io } from 'socket.io-client';

export const socket = io();
