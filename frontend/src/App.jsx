// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import "./App.css"; // Para estilos básicos
import Tablero from "./components/Tablero";
import Arsenal from "./components/Arsenal";

const socket = io("http://localhost:3000"); // Conecta al servidor Express.js

const initialBoard = Array(10)
  .fill(0)
  .map(() => Array(10).fill("E")); // 'E' por Empty

function App() {
  const [messages, setMessages] = useState("");
  const [myBoard, setMyBoard] = useState(initialBoard);
  const [opponentBoardView, setOpponentBoardView] = useState(initialBoard);
  const [gameId, setGameId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [showPlaceShipsButton, setShowPlaceShipsButton] = useState(false);
  const [arsenalSeleccionado, setArsenalSeleccionado] = useState("artilleria");

  // Función para crear/renderizar el tablero
  const renderBoard = useCallback(
    (boardData, isMyBoard, clickHandler = null) => {
      return (
        <div className="board">
          {boardData.map((row, rowIndex) => (
            <Tablero
              isMyBoard={isMyBoard}
              clickHandler={clickHandler}
              isMyTurn={isMyTurn}
              row={row}
              rowIndex={rowIndex}
              key={rowIndex}
            />
          ))}
        </div>
      );
    },
    [isMyTurn]
  ); // Regenerar memo si isMyTurn cambia

  // Lógica básica para posicionar barcos (ejemplo aleatorio)
  const placeShipsRandomly = () => {
    const tempBoard = JSON.parse(JSON.stringify(initialBoard)); // Copia profunda
    const shipSizes = [5, 4, 3, 3, 2]; // Ej. Portaaviones, Acorazado, etc.

    shipSizes.forEach((size) => {
      let placed = false;
      while (!placed) {
        const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
        const startX = Math.floor(
          Math.random() * (10 - (orientation === "horizontal" ? size : 0))
        );
        const startY = Math.floor(
          Math.random() * (10 - (orientation === "vertical" ? size : 0))
        );

        let canPlace = true;
        let cellsToPlace = [];

        for (let i = 0; i < size; i++) {
          const currentX = orientation === "horizontal" ? startX + i : startX;
          const currentY = orientation === "vertical" ? startY + i : startY;

          if (
            currentX >= 10 ||
            currentY >= 10 ||
            tempBoard[currentY][currentX] === "S"
          ) {
            canPlace = false;
            break;
          }
          cellsToPlace.push({ x: currentX, y: currentY });
        }

        if (canPlace) {
          cellsToPlace.forEach((cell) => (tempBoard[cell.y][cell.x] = "S"));
          placed = true;
        }
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
      <div id="messages">{messages}</div>

      <div className="board-container">
        <div>
          <div className="board-label">Tu Tablero</div>
          {renderBoard(myBoard, true)}
        </div>
        <div>
          <div className="board-label">Tablero Enemigo</div>
          {renderBoard(opponentBoardView, false, handleAttackClick)}
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

export default App;
