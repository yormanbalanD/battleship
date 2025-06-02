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

let games = {}; // {game_id: GameInstance}
let waitingPlayers = []; // Lista de IDs de socket de jugadores esperando

/**
 * @type {GameInstance[]}
 */
let waitingGames = []; // Lista de IDs de socket de jugadores esperando

const initialBoard = Array(10)
    .fill(0)
    .map(() => Array(10).fill("E"));

const initialPlayer = {
    board: initialBoard,
    shipsPlaced: false,
    hitsReceived: 0,
    game_over: false,
    points: 0,
    cantidadDeCasillasDeBarco: 0,
}

const arsenales = [
    { id: "artilleria", name: "Artillería", points: 0 },
    { id: "radar", name: "Radar", points: 2 },
    { id: "caza", name: "Caza", points: 3 },
    { id: "avion", name: "Avión", points: 3 }, // Usa el icono importado para 'chorro.png'
    { id: "nuke", name: "Bomba Nuclear", points: 5 },
];

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
            [owner_sid]: { ...initialPlayer },
        };
        this.turnOrder.push(owner_sid);
        this.currentTurn = -1; // O aleatorio
        this.max_players = max_players;
        this.players_conectados = 1;
        this.state = "WAITING";
        console.log(`Se creo la partida ${this.game_id} con ${max_players} jugadores.`);
        this.busqueda_activa = true
    }

    playerConected(player_sid) {
        if (this.players[player_sid] == undefined) {
            this.players_conectados += 1;
            console.log(`Jugador ${player_sid} conectado en partida ${this.game_id}`);
            io.sockets.sockets.get(player_sid)?.join(this.game_id);
            this.turnOrder.push(player_sid);
            this.players[player_sid] = { ...initialPlayer };

            io.to(this.game_id).emit('player_connected', { player_sid, players: this.players, game_id: this.game_id });
            io.to(player_sid).emit('game_found', { game_id: this.game_id, player_sid, players: this.players, message: '¡Encontrada una partida!', partidaEnCurso: this.state == "PLAYING" || this.state == "WAITING_FOR_BOARDS" })

            if (this.players_conectados >= this.max_players && this.state == "WAITING") {
                this.startGame();
            }
        }
    }

    finishAllShipsPlaced() {
        this.state = "PLAYING";
        io.to(this.game_id).emit('game_state_update', { players: this.players, state: 'PLAYING', message: 'Todos Los jugadores han posicionado sus barcos. ¡Comienza el juego!' });
        console.log("Game state updated to PLAYING");
        this.notifyTurn();
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

        let cantidadDeCasillasDeBarco = 0

        for (let i = 0; i < boardData.length; i++) {
            for (let j = 0; j < boardData[i].length; j++) {
                if (boardData[i][j] === 'S') {
                    cantidadDeCasillasDeBarco += 1;
                }
            }
        }
        this.players[player_sid].cantidadDeCasillasDeBarco = cantidadDeCasillasDeBarco;


        io.sockets.sockets.get(player_sid).emit('ships_placed_ok');

        let allShipsPlaced = true

        for (const player in this.players) {
            if (!this.players[player].shipsPlaced) {
                allShipsPlaced = false;
                break;
            }
        }

        if (allShipsPlaced) {
            this.finishAllShipsPlaced();
        }
    }

    notifyTurn() {
        if (this.currentTurn == this.turnOrder.length - 1) {
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

    processAttack(attacker_sid, player_attacked, x, y, type) {
        if (this.turnOrder[this.currentTurn] !== attacker_sid) {
            io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'No es tu turno.' });
            return;
        }

        if (this.players[attacker_sid].points < arsenales.find(arsenal => arsenal.id == type).points) {
            io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'No tienes suficientes puntos para atacar.' });
            return;
        }

        this.players[attacker_sid].points -= arsenales.find(arsenal => arsenal.id == type).points;

        const defender_sid = player_attacked;
        const defenderBoard = this.players[defender_sid].board;

        let result = "MISS";
        const casillasAtacadas = []

        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            switch (type) {
                case "artilleria":
                    if (defenderBoard[y][x] === 'S' || defenderBoard[y][x] === 'L') { // 'S' representa un barco
                        result = "HIT";
                        defenderBoard[y][x] = 'X'; // Marca como golpeado
                        this.players[defender_sid].hitsReceived += 1;
                        this.players[attacker_sid].points += 1;
                        // Aquí iría la lógica para verificar si un barco fue hundido
                    } else if (defenderBoard[y][x] === 'E') { // Evitar re-atacar casillas
                        defenderBoard[y][x] = 'M'; // Marca como fallado
                    } else { // Ya atacado
                        io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'Ya atacaste esta casilla.' });
                        return;
                    }
                    break;
                case "nuke":
                    for (let i = 0; i < defenderBoard.length; i++) {
                        for (let j = 0; j < defenderBoard[i].length; j++) {
                            if (defenderBoard[i][j] === 'S' || defenderBoard[i][j] === 'L') { // 'S' representa un barco
                                defenderBoard[i][j] = 'X'; // Marca como golpeado
                                this.players[defender_sid].hitsReceived += 1;
                                casillasAtacadas.push({ x: j, y: i })
                                this.players[attacker_sid].points += 1;
                                // Aquí iría la lógica para verificar si un barco fue hundido
                            } else if (defenderBoard[i][j] === 'E') { // Evitar re-atacar casillas
                                defenderBoard[i][j] = 'M'; // Marca como fallado
                            }
                        }
                    }
                    break;
                case "avion":
                    const filaCentro = x;
                    const columnaCentro = y;
                    const brazoCruz = 2; // Un brazo de 1 significa el centro + 1 casilla en cada dirección

                    // Rangos para el brazo horizontal
                    const columna_min_h = columnaCentro - brazoCruz;
                    const columna_max_h = columnaCentro + brazoCruz;

                    // Rangos para el brazo vertical
                    const fila_min_v = filaCentro - brazoCruz;
                    const fila_max_v = filaCentro + brazoCruz;

                    for (let i = 0; i < defenderBoard.length; i++) {
                        for (let j = 0; j < defenderBoard[i].length; j++) {

                            const enBrazoHorizontal =
                                j === filaCentro &&
                                i >= columna_min_h &&
                                i <= columna_max_h;

                            // Verificar si la casilla está en el brazo vertical
                            const enBrazoVertical =
                                i === columnaCentro && j >= fila_min_v && j <= fila_max_v;

                            const esEsquinaDiagonal =
                                (j === filaCentro - 1 && i === columnaCentro - 1) || // Esquina superior izquierda
                                (j === filaCentro - 1 && i === columnaCentro + 1) || // Esquina superior derecha
                                (j === filaCentro + 1 && i === columnaCentro - 1) || // Esquina inferior izquierda
                                (j === filaCentro + 1 && i === columnaCentro + 1);
                            // Si está en el brazo horizontal O en el brazo vertical, está en la cruz
                            if (enBrazoHorizontal || enBrazoVertical || esEsquinaDiagonal) {
                                if (defenderBoard[i][j] === 'S' || defenderBoard[i][j] === 'L') { // 'S' representa un barco
                                    defenderBoard[i][j] = 'X'; // Marca como golpeado
                                    this.players[defender_sid].hitsReceived += 1;
                                    this.players[attacker_sid].points += 1;
                                    casillasAtacadas.push({ x: j, y: i })
                                    // Aquí iría la lógica para verificar si un barco fue hundido
                                } else if (defenderBoard[i][j] === 'E') { // Evitar re-atacar casillas
                                    defenderBoard[i][j] = 'M'; // Marca como fallado
                                }
                            }
                        }
                    }
                    break;
                case "radar":
                    for (let i = 0; i < defenderBoard.length; i++) {
                        for (let j = 0; j < defenderBoard[i].length; j++) {
                            if (
                                j > x - 2 &&
                                j < x + 2 &&
                                i > y - 2 &&
                                i < y + 2
                            ) {
                                if (defenderBoard[i][j] === 'S') { // 'S' representa un barco
                                    defenderBoard[i][j] = 'L'; // Marca como looked
                                }
                            }
                        }
                    }
                    break;
                case "caza":
                    for (let i = 0; i < defenderBoard.length; i++) {
                        for (let j = 0; j < defenderBoard[i].length; j++) {
                            if (
                                i > y - 2 &&
                                i < y + 2
                            ) {
                                if (defenderBoard[i][j] === 'S' || defenderBoard[i][j] === 'L') { // 'S' representa un barco
                                    defenderBoard[i][j] = 'X'; // Marca como golpeado
                                    this.players[defender_sid].hitsReceived += 1;
                                    casillasAtacadas.push({ x: j, y: i })
                                    this.players[attacker_sid].points += 1;
                                    // Aquí iría la lógica para verificar si un barco fue hundido
                                } else if (defenderBoard[i][j] === 'E') { // Evitar re-atacar casillas
                                    defenderBoard[i][j] = 'M'; // Marca como fallado
                                }
                            }
                        }
                    }
            }
        } else {
            io.sockets.sockets.get(attacker_sid).emit('error_message', { message: 'Coordenadas de ataque inválidas.' });
            return;
        }


        this.players[defender_sid].board = defenderBoard;

        io.to(this.game_id).emit('attack_result', { x, y, result, players: this.players, player_attacked });
        console.log(`Ataque de ${attacker_sid} en (${x},${y}): ${result}`);

        // Lógica de victoria (ejemplo: 5 hits para ganar)
        console.log(`Cantidad de casillas de barco de ${defender_sid}: ${this.players[defender_sid].cantidadDeCasillasDeBarco}`);
        console.log(`Hits recibidos de ${defender_sid}: ${this.players[defender_sid].hitsReceived}`);
        if (this.players[defender_sid].cantidadDeCasillasDeBarco <= this.players[defender_sid].hitsReceived) {
            this.gameOver(defender_sid);
        }

        // Cambiar turno
        if (this.state == "PLAYING") {
            this.notifyTurn();
        }
    }

    disconnectPlayer(player_sid) {
        if (this.state == "PLAYING" || this.state == "WAITING_FOR_BOARDS") {
            this.gameOver(player_sid);
        }

        if (this.players[player_sid]) {
            delete this.players[player_sid];
            this.players_conectados -= 1;
            console.log(`Jugador ${player_sid} desconectado en partida ${this.game_id}`);
        }

        if (this.players_conectados == 0) {
            if (this.state == "PLAYING" || this.state == "WAITING_FOR_BOARDS") {
                delete games[this.game_id];
            } else {
                const index = waitingGames.findIndex((game) => game.game_id == this.game_id);
                if (index > -1) {
                    waitingGames.splice(index, 1);
                }
            }

            console.log(`Juego ${this.game_id} terminado.`);
        }

        if (this.state == "WAITING_FOR_BOARDS") {
            let allShipsPlaced = true
            for (const player in this.players) {
                if (!this.players[player].shipsPlaced) {
                    allShipsPlaced = false;
                    break;
                }
            }

            if (allShipsPlaced) {
                this.finishAllShipsPlaced();
            }
        }
    }

    startGame() {
        const gameIndex = waitingGames.find(game => game.game_id == this.game_id);

        games[this.game_id] = this;
        waitingGames.splice(gameIndex, 1);

        this.state = "WAITING_FOR_BOARDS";
        io.to(this.game_id).emit('game_started', { game_id: this.game_id, message: '¡Empezamos la partida! Posiciona tus barcos.', players: this.players });
    }

    winGame(player_sid) {
        console.log(`Jugador ${player_sid} ha ganado la partida.`);
        this.state = "GAME_OVER";
        io.to(this.game_id).emit('game_ended', { message: `¡El jugador ${player_sid} ha ganado!`, players: this.players, player_sid });
        delete games[this.game_id]; // Limpiar la partida del diccionario global
    }

    gameOver(player_sid) {
        this.players[player_sid].game_over = true;
        const index = this.turnOrder.indexOf(player_sid);
        this.turnOrder.splice(index, 1);

        if (this.turnOrder[this.currentTurn] == player_sid) {
            this.notifyTurn()
        }

        if (this.turnOrder.length > 1) {
            console.log(`Jugador ${player_sid} ha terminado la partida.`);
            io.to(this.game_id).emit('game_over', { message: `¡El jugador ${player_sid} ha perdido!`, players: this.players, player_sid });
        } else {
            this.winGame(this.turnOrder[0]);
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

        if (Object.keys(games).length >= 1) {
            for (const gameId in games) {
                const game = games[gameId];
                if (game.max_players == game.players_conectados) {
                    continue;
                }

                if (game.busqueda_activa) {
                    game.playerConected(socket.id)
                    return
                }
            }
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

        waitingGames.forEach((game, index) => {
            if (game.players[socket.id] != undefined) {
                game.disconnectPlayer(socket.id);
                socket.leave(game.game_id);
                io.to(game.game_id).emit('player_disconnected', { message: 'Un jugador se ha desconectado.', players: game.players });
            }
        })

        // Buscar la partida y notificar al otro jugador si aplica
        for (const gameId in games) {
            console.log(`Buscando juego ${gameId}...`);
            const game = games[gameId];
            if (game.players[socket.id] != undefined) {
                console.log(`Player ${socket.id} has disconnected from game ${gameId}.`);
                // io.to(opponentSid).emit('opponent_disconnected', { message: 'Tu oponente se ha desconectado. Has ganado la partida.' });
                game.disconnectPlayer(socket.id);
                // Limpiar la partida
                // delete games[gameId];
                socket.leave(gameId);
                io.to(gameId).emit('player_disconnected', { message: 'Un jugador se ha desconectado.', players: game.players });
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
        const type = data.type;
        if (games[gameId]) {
            games[gameId].processAttack(socket.id, playerAttacked, x, y, type);
        } else {
            io.to(socket.id).emit('error_message', { message: 'Partida no encontrada.' });
        }
    });

    socket.on('force_start_game', (data) => {
        const gameId = data.game_id;
        console.log(`Jugador ${socket.id} ha forzado la partida ${gameId} a comenzar.`);
        const game = waitingGames.find(game => game.game_id == gameId);
        if (game != undefined) {
            game.startGame();
        }
    })

    socket.on('permitir_nuevos_jugadores', (data) => {
        const gameId = data.game_id;
        const permitir = data.permitir;

        games[gameId].busqueda_activa = permitir;
    })

    socket.on('restart_server', () => {
        console.log("Reiniciando servidor...");
        games = {};
        waitingGames = [];
        waitingPlayers = [];
        io.sockets.emit('restart_server');
    })
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});