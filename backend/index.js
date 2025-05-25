// server.js (Servidor Express.js + Socket.IO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // URL de tu frontend React (Vite)
        methods: ["GET", "POST"]
    }
});

// Sirve los archivos estáticos de tu aplicación React (después de 'npm run build')
// En desarrollo, Vite se encarga de servir el frontend, así que esto es más para producción.
// app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// --- Estructuras de datos del juego ---
const games = {}; // {game_id: GameInstance}
const waitingPlayers = []; // Lista de IDs de socket de jugadores esperando

class GameInstance {
    constructor(player1_sid, player2_sid) {
        this.game_id = uuidv4();
        this.player1_sid = player1_sid;
        this.player2_sid = player2_sid;
        this.players = {
            [player1_sid]: { board: [], shipsPlaced: false, hitsReceived: 0 },
            [player2_sid]: { board: [], shipsPlaced: false, hitsReceived: 0 }
        };
        this.currentTurn = player1_sid; // O aleatorio
        this.state = "WAITING_FOR_BOARDS";
        console.log(`Partida ${this.game_id} creada entre ${player1_sid} y ${player2_sid}`);

        // Los jugadores se unen a una "sala" de Socket.IO
        io.sockets.sockets.get(player1_sid)?.join(this.game_id);
        io.sockets.sockets.get(player2_sid)?.join(this.game_id);
    }

    placeShips(player_sid, boardData) {
        if (!this.players[player_sid]) {
            io.to(player_sid).emit('error_message', { message: 'No eres parte de esta partida.' });
            return;
        }
        // Aquí iría la lógica de validación del tablero
        this.players[player_sid].board = boardData;
        this.players[player_sid].shipsPlaced = true;
        console.log(`Barcos de ${player_sid} posicionados en partida ${this.game_id}`);

        io.to(player_sid).emit('ships_placed_ok');

        if (this.players[this.player1_sid].shipsPlaced && this.players[this.player2_sid].shipsPlaced) {
            this.state = "PLAYING";
            io.to(this.game_id).emit('game_state_update', { state: 'PLAYING', message: 'Ambos jugadores han posicionado sus barcos. ¡Comienza el juego!' });
            this.notifyTurn();
        }
    }

    notifyTurn() {
        io.to(this.currentTurn).emit('your_turn');
        const otherPlayerSid = this.player1_sid === this.currentTurn ? this.player2_sid : this.player1_sid;
        io.to(otherPlayerSid).emit('wait_turn');
        console.log(`Turno de: ${this.currentTurn}`);
    }

    processAttack(attacker_sid, x, y) {
        if (this.currentTurn !== attacker_sid) {
            io.to(attacker_sid).emit('error_message', { message: 'No es tu turno.' });
            return;
        }

        const defender_sid = this.player1_sid === attacker_sid ? this.player2_sid : this.player1_sid;
        const defenderBoard = this.players[defender_sid].board;

        let result = "MISS";
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            if (defenderBoard[y][x] === 'S') { // 'S' representa un barco
                result = "HIT";
                defenderBoard[y][x] = 'X'; // Marca como golpeado
                this.players[defender_sid].hitsReceived += 1;
                // Aquí iría la lógica para verificar si un barco fue hundido
            } else if (defenderBoard[y][x] === 'E') { // Evitar re-atacar casillas
                defenderBoard[y][x] = 'M'; // Marca como fallado
            } else { // Ya atacado
                io.to(attacker_sid).emit('error_message', { message: 'Ya atacaste esta casilla.' });
                return;
            }
        } else {
            io.to(attacker_sid).emit('error_message', { message: 'Coordenadas de ataque inválidas.' });
            return;
        }

        io.to(attacker_sid).emit('attack_result', { x, y, result });
        io.to(defender_sid).emit('opponent_attacked', { x, y, result });
        console.log(`Ataque de ${attacker_sid} en (${x},${y}): ${result}`);

        // Lógica de victoria (ejemplo: 5 hits para ganar)
        if (this.players[defender_sid].hitsReceived >= 5) {
            this.state = "GAME_OVER";
            io.to(this.game_id).emit('game_over', { winner_sid: attacker_sid, message: '¡Fin de la partida!' });
            console.log(`Partida ${this.game_id} terminada. Ganador: ${attacker_sid}`);
            delete games[this.game_id]; // Limpiar la partida del diccionario global
            io.sockets.sockets.get(this.player1_sid)?.leave(this.game_id);
            io.sockets.sockets.get(this.player2_sid)?.leave(this.game_id);
            return;
        }

        // Cambiar turno
        this.currentTurn = defender_sid;
        this.notifyTurn();
    }
}

io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);
    waitingPlayers.push(socket.id);

    if (waitingPlayers.length >= 2) {
        const player1_sid = waitingPlayers.shift();
        const player2_sid = waitingPlayers.shift();
        const game = new GameInstance(player1_sid, player2_sid);
        games[game.game_id] = game;

        io.to(player1_sid).emit('game_found', { game_id: game.game_id, player_id: player1_sid, message: 'Partida encontrada. Coloca tus barcos.' });
        io.to(player2_sid).emit('game_found', { game_id: game.game_id, player_id: player2_sid, message: 'Partida encontrada. Coloca tus barcos.' });
    } else {
        io.to(socket.id).emit('waiting_for_opponent', { message: 'Esperando otro jugador...' });
    }

    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
        // Remover de la lista de espera si estaba allí
        const index = waitingPlayers.indexOf(socket.id);
        if (index > -1) {
            waitingPlayers.splice(index, 1);
        }

        // Buscar la partida y notificar al otro jugador si aplica
        for (const gameId in games) {
            const game = games[gameId];
            if (socket.id === game.player1_sid || socket.id === game.player2_sid) {
                const opponentSid = socket.id === game.player1_sid ? game.player2_sid : game.player1_sid;
                io.to(opponentSid).emit('opponent_disconnected', { message: 'Tu oponente se ha desconectado. Has ganado la partida.' });
                
                // Limpiar la partida
                delete games[gameId];
                io.sockets.sockets.get(game.player1_sid)?.leave(gameId);
                io.sockets.sockets.get(game.player2_sid)?.leave(gameId);
                console.log(`Partida ${gameId} terminada por desconexión.`);
                break;
            }
        }
    });

    socket.on('place_ships', (data) => {
        const gameId = data.game_id;
        const boardData = data.board;
        if (games[gameId]) {
            games[gameId].placeShips(socket.id, boardData);
        } else {
            io.to(socket.id).emit('error_message', { message: 'Partida no encontrada.' });
        }
    });

    socket.on('attack', (data) => {
        const gameId = data.game_id;
        const x = data.x;
        const y = data.y;
        if (games[gameId]) {
            games[gameId].processAttack(socket.id, x, y);
        } else {
            io.to(socket.id).emit('error_message', { message: 'Partida no encontrada.' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});