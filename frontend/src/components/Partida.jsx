import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import Tablero from "./Tablero";

const socket = io("http://localhost:3000"); // Conecta al servidor Express.js
const initialBoard = Array(10)
  .fill(0)
  .map(() => Array(10).fill("E")); // 'E' por Empty

export default function Partida({ isCreadorDeSala, setPagina }) {
  const [messages, setMessages] = useState("");
  const [myBoard, setMyBoard] = useState(initialBoard);
  const [opponentBoardView, setOpponentBoardView] = useState(initialBoard);
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
    setMessages("Barcos posicionados. Esperando al oponente...");
    setShowPlaceShipsButton(false);
  };

  const handleAttackClick = (x, y) => {
    if (!isMyTurn) {
      setMessages("No es tu turno.");
      return;
    }
    if (opponentBoardView[y][x] !== "E") {
      setMessages("Ya atacaste esta casilla.");
      return;
    }
    socket.emit("attack", { game_id: gameId, x, y });
    setIsMyTurn(false); // Asumimos que el turno cambiará
    setMessages("Atacando...");
  };

  useEffect(() => {
    socket.on("connect", () => {
      setMessages("Conectado al servidor.");
    });

    socket.on("disconnect", () => {
      setMessages("Desconectado del servidor.", "red");
      setGameId(null);
      setMyPlayerId(null);
      setIsMyTurn(false);
    });

    socket.on("waiting_for_opponent", (data) => {
      setMessages(data.message);
    });

    socket.on("game_found", (data) => {
      setGameId(data.game_id);
      setMyPlayerId(data.player_id);
      setMessages(data.message);
      setShowPlaceShipsButton(true);
      setMyBoard(initialBoard); // Resetear mi tablero
      setOpponentBoardView(initialBoard); // Resetear tablero enemigo
    });

    socket.on("ships_placed_ok", () => {
      setMessages("Tus barcos han sido registrados.");
    });

    socket.on("game_state_update", (data) => {
      setMessages(data.message);
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
      const { x, y, result } = data;
      setOpponentBoardView((prevBoard) => {
        const newBoard = JSON.parse(JSON.stringify(prevBoard));
        newBoard[y][x] = result === "HIT" ? "X" : "M";
        return newBoard;
      });
      setMessages(`Atacaste (${x}, ${y}): ${result}`);
    });

    socket.on("opponent_attacked", (data) => {
      const { x, y, result } = data;
      setMyBoard((prevBoard) => {
        const newBoard = JSON.parse(JSON.stringify(prevBoard));
        newBoard[y][x] = result === "HIT" ? "X" : "M";
        return newBoard;
      });
      setMessages(`Tu oponente atacó (${x}, ${y}): ${result}`);
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

    socket.on("opponent_disconnected", (data) => {
      setMessages(data.message);
      setIsMyTurn(false);
      setGameId(null);
      setMyPlayerId(null);
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
            dataTablero={myBoard}
            // clickHandler={clickHandler}
            isMyBoard={true}
            isMyTurn={isMyTurn}
            arsenalSeleccionado={arsenalSeleccionado}
          />
        </div>
        <div>
          <div className="board-label">Tablero Enemigo</div>
          <Tablero
            dataTablero={opponentBoardView}
            clickHandler={handleAttackClick}
            isMyTurn={isMyTurn}
            arsenalSeleccionado={arsenalSeleccionado}
          />
        </div>
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
