import React, { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";

import Tablero from "./Tablero";
import Arsenal from "./Arsenal";
import { toast } from "react-toastify";

const initialBoard = Array(10)
  .fill(0)
  .map(() => Array(10).fill("E")); // 'E' por Empty

export default function Partida({ isCreadorDeSala, setPagina, maxPlayers }) {
  const [messages, setMessages] = useState("");
  const [myBoard, setMyBoard] = useState(initialBoard);
  const [opponentBoardView, setOpponentBoardView] = useState(initialBoard);
  const [players, setPlayers] = useState({});
  const [gameId, setGameId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [showPlaceShipsButton, setShowPlaceShipsButton] = useState(false);
  const [arsenalSeleccionado, setArsenalSeleccionado] = useState("artilleria");

  // Lógica para posicionar barcos aleatoriamente con separación
  const placeShipsRandomly = () => {
    const tempBoard = JSON.parse(JSON.stringify(initialBoard)); // Copia profunda para trabajar
    const boardSize = 10; // Tamaño del tablero
    const shipSizes = [5, 4, 3, 3, 2]; // Tamaños de los barcos

    // Función auxiliar para verificar si una celda está dentro de los límites del tablero
    const isValidCell = (x, y) => {
      return x >= 0 && x < boardSize && y >= 0 && y < boardSize;
    };

    // Función auxiliar para verificar si alguna casilla adyacente (incluyendo diagonales) ya está ocupada por un barco
    const hasAdjacentShip = (board, x, y) => {
      // Definir los 8 vecinos (incluyendo diagonales)
      const neighbors = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 }, // Arriba-Izquierda, Arriba, Arriba-Derecha
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }, // Izquierda, Derecha
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 }, // Abajo-Izquierda, Abajo, Abajo-Derecha
      ];

      for (const neighbor of neighbors) {
        const nx = x + neighbor.dx;
        const ny = y + neighbor.dy;

        // Si la celda vecina es válida y está ocupada por un barco
        if (isValidCell(nx, ny) && board[ny][nx] === "S") {
          return true; // Se encontró un barco adyacente
        }
      }
      return false; // No se encontraron barcos adyacentes
    };

    shipSizes.forEach((size) => {
      let placed = false;
      let attempts = 0; // Para evitar bucles infinitos si no se puede colocar
      const maxAttempts = 1000; // Límite de intentos por barco

      while (!placed && attempts < maxAttempts) {
        attempts++;
        const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
        const startX = Math.floor(
          Math.random() *
            (boardSize - (orientation === "horizontal" ? size : 0))
        );
        const startY = Math.floor(
          Math.random() * (boardSize - (orientation === "vertical" ? size : 0))
        );

        let canPlace = true;
        let cellsToOccupy = []; // Celdas que el barco intentaría ocupar

        for (let i = 0; i < size; i++) {
          const currentX = orientation === "horizontal" ? startX + i : startX;
          const currentY = orientation === "vertical" ? startY + i : startY;

          // 1. Verificar límites del tablero
          if (!isValidCell(currentX, currentY)) {
            canPlace = false;
            break;
          }

          // 2. Verificar que la casilla no esté ya ocupada por otro barco
          if (tempBoard[currentY][currentX] === "S") {
            canPlace = false;
            break;
          }

          // 3. **Verificar que NO haya barcos adyacentes a esta celda**
          if (hasAdjacentShip(tempBoard, currentX, currentY)) {
            canPlace = false;
            break;
          }

          cellsToOccupy.push({ x: currentX, y: currentY });
        }

        // Si todas las verificaciones pasaron, colocamos el barco
        if (canPlace) {
          cellsToOccupy.forEach((cell) => (tempBoard[cell.y][cell.x] = "S"));
          placed = true;
        }
      }

      // Opcional: Manejar el caso si no se pudo colocar un barco después de muchos intentos
      if (!placed) {
        console.warn(
          `No se pudo colocar el barco de tamaño ${size} después de ${maxAttempts} intentos.`
        );
        // Podrías lanzar un error, intentar de nuevo con un tablero limpio,
        // o simplemente continuar sin ese barco. Para juegos simples, una advertencia es suficiente.
      }
    });

    setMyBoard(tempBoard);
    return tempBoard;
  };

  const handlePlaceShips = () => {
    const placedShipsBoard = placeShipsRandomly();
    socket.emit("place_ships", { game_id: gameId, board: placedShipsBoard });
    const temp = { ...players };
    temp[myPlayerId].board = placedShipsBoard;
    setPlayers(temp);
    setMessages("Barcos posicionados. Esperando al oponente...");
    setShowPlaceShipsButton(false);
  };

  const handleAttackClick = (x, y, player_sid) => {
    if (!isMyTurn) {
      setMessages("No es tu turno.");
      return;
    }
    if (opponentBoardView[y][x] !== "E") {
      setMessages("Ya atacaste esta casilla.");
      return;
    }
    socket.emit("attack", { game_id: gameId, x, y, player_sid });
    setIsMyTurn(false); // Asumimos que el turno cambiará
    setMessages("Atacando...");
  };

  useEffect(() => {
    setMyPlayerId(socket.id);
    socket.on("connect", () => {
      console.log("Conectado al servidor.");
    });

    socket.on("disconnect", () => {
      console.log("Desconectado del servidor.", "red");
      setGameId(null);
      setMyPlayerId(null);
      setIsMyTurn(false);
    });

    socket.on("waiting_for_opponent", (data) => {
      setMessages(data.message);
    });

    socket.on("game_started", (data) => {
      setMessages(data.message);
      setGameId(data.game_id);
      setPlayers(data.players);
      setShowPlaceShipsButton(true);
    });

    socket.on("game_found", (data) => {
      setGameId(data.game_id);
      setMyPlayerId(data.player_id);
      setMessages(data.message);

      delete data.players[data.player_id];

      // setEnemigos(data.players);
      setMyBoard(initialBoard); // Resetear mi tablero
      setOpponentBoardView(initialBoard); // Resetear tablero enemigo
    });

    socket.on("player_connected", (data) => {
      toast.info(`¡Nuevo jugador conectado!`);
      setPlayers(data.players);
      console.log(data);
      // delete data.players[myPlayerId];
    });

    socket.on("ships_placed_ok", () => {
      setMessages("Tus barcos han sido registrados.");
    });

    socket.on("game_state_update", (data) => {
      setMessages(data.message);
      setPlayers(data.players);
    });

    socket.on("your_turn", () => {
      setIsMyTurn(true);
      setMessages("¡Es tu turno! Ataca el tablero enemigo.");
    });

    socket.on("wait_turn", () => {
      setIsMyTurn(false);
      setMessages("Esperando el turno del oponente...");
    });

    socket.on("attack_result", (data) => {
      const { x, y, result, player_attacked } = data;
      const newBoard = [...players[player_attacked].board];

      newBoard[y][x] = result === "HIT" ? "X" : "M";
      const temp = { ...players };
      temp[player_attacked].board = newBoard;
      setPlayers(temp);
      if(socket.id == player_attacked){
        setMessages(`Tu oponente atacó (${x}, ${y}): ${result}`);
      } else {
        setMessages(`Atacaron al jugador ${player_attacked} (${x}, ${y}): ${result}`);
      }
    });

    socket.on("game_over", (data) => {
      const winnerMessage =
        data.winner_sid === myPlayerId
          ? "¡Has ganado la partida!"
          : "Has perdido la partida.";
      setMessages(`Juego Terminado: ${winnerMessage}`, "purple");
      setIsMyTurn(false);
      setGameId(null);
      setMyPlayerId(null);
    });

    socket.on("player_disconnected", (data) => {
      // setMessages(data.message);
      // setIsMyTurn(false);
      // setGameId(null);
      // setMyPlayerId(null);
      console.log(data.message);
    });

    socket.on("error_message", (data) => {
      setMessages(`Error: ${data.message}`);
    });

    // Limpieza de event listeners al desmontar el componente
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("waiting_for_opponent");
      socket.off("game_found");
      socket.off("ships_placed_ok");
      socket.off("game_state_update");
      socket.off("your_turn");
      socket.off("wait_turn");
      socket.off("attack_result");
      socket.off("opponent_attacked");
      socket.off("game_over");
      socket.off("opponent_disconnected");
      socket.off("error_message");
    };
  }, [myPlayerId, gameId, isMyTurn]); // Dependencias para useEffect

  useEffect(() => {
    if (isCreadorDeSala) {
      console.log("Creando partida...");
      socket.emit("create_game", {
        owner_sid: myPlayerId,
        max_players: maxPlayers,
      });
    } else {
      socket.emit("search_game", {});
    }
  }, []);

  useEffect(() => {
    console.log(players);
  }, [players]);

  return (
    <div className="App">
      <h1>Batalla Naval</h1>
      <div
        id="messages"
        onClick={() => {
          console.log(myBoard);
        }}
      >
        {messages}
      </div>

      <div className="board-container">
        <div>
          <div className="board-label">Tu Tablero</div>
          <Tablero
            dataTablero={
              players[myPlayerId] ? players[myPlayerId].board : myBoard
            }
            player_sid={myPlayerId}
            isMyBoard={true}
            isMyTurn={isMyTurn}
            arsenalSeleccionado={arsenalSeleccionado}
          />
        </div>
        {Object.keys(players).length > 1 &&
          Object.keys(players)
            .filter((player) => player != myPlayerId)
            .map((player, index) => (
              <div key={index}>
                <div className="board-label">Tablero Enemigo</div>
                <Tablero
                  player_sid={player}
                  dataTablero={players[player].board}
                  clickHandler={handleAttackClick}
                  isMyTurn={isMyTurn}
                  arsenalSeleccionado={arsenalSeleccionado}
                />
              </div>
            ))}
      </div>

      <div id="controls">
        {showPlaceShipsButton && (
          <button onClick={handlePlaceShips}>
            Posicionar Barcos Aleatoriamente
          </button>
        )}
      </div>

      <Arsenal
        arsenalSeleccionado={arsenalSeleccionado}
        setArsenalSeleccionado={setArsenalSeleccionado}
      />
    </div>
  );
}
