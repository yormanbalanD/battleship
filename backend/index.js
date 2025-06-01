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

/**
 * @type {GameInstance[]}
 */
const waitingGames = []; // Lista de IDs de socket de jugadores esperando

const initialBoard = Array(10)
    .fill(0)
    .map(() => Array(10).fill("E"));

class GameInstance {
    players = {};

    players_conectados = 0;
    max_players;
    owner_sid;
    game_id;
    state;
    currentTurn;
    turnOrder = [];

    constructor(owner_sid, max_players) {
        this.game_id = uuidv4();
        this.owner_sid = owner_sid
        this.players = {
            [owner_sid]: { board: initialBoard, shipsPlaced: false, hitsReceived: 0 },
        };
        this.turnOrder.push(owner_sid);
        this.currentTurn = -1; // O aleatorio
        this.max_players = max_players;
        this.players_conectados = 1;
        this.state = "WAITING_FOR_BOARDS";
        console.log(`Se creo la partida ${this.game_id} con ${max_players} jugadores.`);
    }

    playerConected(player_sid) {
        if (this.players[player_sid] == undefined) {
            this.players_conectados += 1;
            console.log(`Jugador ${player_sid} conectado en partida ${this.game_id}`);
            io.sockets.sockets.get(player_sid)?.join(this.game_id);
            this.turnOrder.push(player_sid);
            this.players[player_sid] = {
                board: initialBoard,
                shipsPlaced: false,
                hitsReceived: 0
            }

            io.to(this.game_id).emit('player_connected', { player_sid, players: this.players });
            io.to(player_sid).emit('game_found', { game_id: this.game_id, player_sid, players: this.players, message: '¡Encontrada una partida!' })

            if (this.players_conectados >= this.max_players) {
                this.state = "PLAYING";
                io.to(this.game_id).emit('game_started', { game_id: this.game_id, message: '¡Empezamos la partida! Posiciona tus barcos.', players: this.players });
            }
        }
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

        io.sockets.sockets.get(player_sid).emit('ships_placed_ok');

        let allShipsPlaced = true

        for (const player in this.players) {
            if (!this.players[player].shipsPlaced) {
                allShipsPlaced = false;
                break;
            }
        }

        if (allShipsPlaced) {
            this.state = "PLAYING";
            io.to(this.game_id).emit('game_state_update', { players: this.players, state: 'PLAYING', message: 'Todos Los jugadores han posicionado sus barcos. ¡Comienza el juego!' });
            this.notifyTurn();
        }
    }

    notifyTurn() {
        if (this.currentTurn === this.turnOrder.length - 1) {
            this.currentTurn = 0;
        } else {
            this.currentTurn += 1;
        }

        io.sockets.sockets.get(this.turnOrder[this.currentTurn]).emit('your_turn');

        this.turnOrder.forEach((playerSid) => {
            if (playerSid != this.turnOrder[this.currentTurn]) {
                io.to(playerSid).emit('wait_turn');
            }
        });
    }

    processAttack(attacker_sid, player_attacked, x, y) {
        if (this.turnOrder[this.currentTurn] !== attacker_sid) {
            io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'No es tu turno.' });
            return;
        }

        const defender_sid = player_attacked;
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
                io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'Ya atacaste esta casilla.' });
                return;
            }
        } else {
            io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'Coordenadas de ataque inválidas.' });
            return;
        }

        io.to(this.game_id).emit('attack_result', { x, y, result, players: this.players, player_attacked });
        console.log(`Ataque de ${attacker_sid} en (${x},${y}): ${result}`);

        // Lógica de victoria (ejemplo: 5 hits para ganar)
        if (false && this.players[defender_sid].hitsReceived >= 5) {
            this.state = "GAME_OVER";
            io.to(this.game_id).emit('game_over', { winner_sid: attacker_sid, message: '¡Fin de la partida!' });
            console.log(`Partida ${this.game_id} terminada. Ganador: ${attacker_sid}`);
            delete games[this.game_id]; // Limpiar la partida del diccionario global
            io.sockets.sockets.get(this.player0_sid)?.leave(this.game_id);
            io.sockets.sockets.get(this.player1_sid)?.leave(this.game_id);
            return;
        }

        // Cambiar turno
        this.notifyTurn();
    }

    disconnectPlayer(player_sid) {
        if (this.players[player_sid]) {
            delete this.players[player_sid];
            this.players_conectados -= 1;
            console.log(`Jugador ${player_sid} desconectado en partida ${this.game_id}`);
        }
    }
}

io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    socket.on('create_game', ({
        max_players
    }) => {

        waitingGames.forEach((game, index) => {
            if (game.owner_sid == socket.id) {
                console.log(`Player ${socket.id} is already in a game.`);
                waitingGames.splice(index, 1);
                socket.leave(game.game_id);
            }
        })

        console.log(`Partida creada por ${socket.id}`);
        const game = new GameInstance(socket.id, max_players);
        waitingGames.push(game);

        socket.join(game.game_id);

        io.to(socket.id).emit('waiting_for_opponent', { message: 'Esperando otro jugador...' });

        if (waitingPlayers.length > 0) {
            waitingPlayers.forEach((playerSid) => {
                if (game.players_conectados < game.max_players) {
                    game.playerConected(playerSid)
                }
            })
        }
    })

    socket.on('search_game', () => {
        console.log(`Player ${socket.id} is searching for a game.`);

        if (waitingGames.length > 0) {
            const game = waitingGames[0]
            game.playerConected(socket.id)

            if (game.state == "PLAYING") {
                games[game.game_id] = game
            }

            socket.emit('game_found', { game_id: game.game_id, players: game.players, message: '¡Encontrada una partida!' })
            return
        }

        waitingPlayers.push(socket.id);
    })

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
            if (game.players[socket.id] != undefined) {
                console.log(`Player ${socket.id} has disconnected from game ${gameId}.`);
                // io.to(opponentSid).emit('opponent_disconnected', { message: 'Tu oponente se ha desconectado. Has ganado la partida.' });
                game.disconnectPlayer(socket.id);
                // Limpiar la partida
                // delete games[gameId];
                socket.leave(gameId);
                io.to(gameId).emit('player_disconnected', { message: 'Un jugador se ha desconectado.' });
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
        const playerAttacked = data.player_sid;
        if (games[gameId]) {
            games[gameId].processAttack(socket.id, playerAttacked, x, y);
        } else {
            io.to(socket.id).emit('error_message', { message: 'Partida no encontrada.' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});