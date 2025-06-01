// Partida.jsx
import React, { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";

import Tablero from "./Tablero";
import Arsenal from "./Arsenal";
import { toast } from "react-toastify";
import Barcos from "./Barcos"; // Importa el nuevo componente Barcos.jsx
import "../styles/partida.css"; // Asegúrate de tener un archivo CSS para Partida

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
  const [showPlaceShipsButton, setShowPlaceShipsButton] = useState(false); // Botón de posicionar aleatoriamente
  const [showManualPlacementPanel, setShowManualPlacementPanel] =
    useState(false); // Nuevo estado para el panel manual
  const [arsenalSeleccionado, setArsenalSeleccionado] = useState("artilleria");
  const [waitingOponents, setWaitingOponents] = useState(true);

  // Lógica para posicionar barcos aleatoriamente con separación (mantenerla por si acaso)
  const placeShipsRandomly = () => {
    const tempBoard = JSON.parse(JSON.stringify(initialBoard)); // Copia profunda para trabajar
    const boardSize = 10; // Tamaño del tablero
    const shipSizes = [5, 4, 3, 3, 2]; // Tamaños de los barcos

    const isValidCell = (x, y) =>
      x >= 0 && x < boardSize && y >= 0 && y < boardSize;

    const hasAdjacentShip = (board, x, y) => {
      const neighbors = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
      ];
      for (const neighbor of neighbors) {
        const nx = x + neighbor.dx;
        const ny = y + neighbor.dy;
        if (isValidCell(nx, ny) && board[ny][nx] === "S") {
          return true;
        }
      }
      return false;
    };

    shipSizes.forEach((size) => {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 1000;

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
        let cellsToOccupy = [];

        for (let i = 0; i < size; i++) {
          const currentX = orientation === "horizontal" ? startX + i : startX;
          const currentY = orientation === "vertical" ? startY + i : startY;

          if (
            !isValidCell(currentX, currentY) ||
            tempBoard[currentY][currentX] === "S" ||
            hasAdjacentShip(tempBoard, currentX, currentY)
          ) {
            canPlace = false;
            break;
          }
          cellsToOccupy.push({ x: currentX, y: currentY });
        }

        if (canPlace) {
          cellsToOccupy.forEach((cell) => (tempBoard[cell.y][cell.x] = "S"));
          placed = true;
        }
      }

      if (!placed) {
        console.warn(
          `No se pudo colocar el barco de tamaño ${size} después de ${maxAttempts} intentos.`
        );
      }
    });

    setMyBoard(tempBoard);
    return tempBoard;
  };

  const handlePlaceShipsRandomly = () => {
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
    socket.emit("attack", {
      game_id: gameId,
      x,
      y,
      player_sid,
      type: arsenalSeleccionado,
    });
    setIsMyTurn(false); // Asumimos que el turno cambiará
    setMessages("Atacando...");
  };

  const handleManualPlacement = () => {
    // Al hacer clic en "Colocar Barcos Manualmente", mostramos el panel y reseteamos el tablero si no tiene barcos
    // Puedes decidir si quieres resetear el tablero o permitir modificar los existentes
    // Por simplicidad, aquí asumimos que reseteas para una nueva colocación manual.
    setMyBoard(initialBoard);
    setShowManualPlacementPanel(true);
    setShowPlaceShipsButton(false); // Oculta el botón de aleatorio
    setMessages("Coloca tus barcos manualmente en tu tablero.");
  };

  // Función para cuando la colocación manual esté terminada
  const handleManualPlacementDone = (finalBoard) => {
    socket.emit("place_ships", { game_id: gameId, board: finalBoard });
    setMessages("Barcos posicionados manualmente. Esperando al oponente...");
    setShowManualPlacementPanel(false); // Cierra el panel
  };

  useEffect(() => {
    setMyPlayerId(socket.id);
    socket.on("connect", () => {
      console.log("Conectado al servidor.");
    });

    // socket.onAny((eventName, ...args) => {
    //   console.log(`Received event ${eventName}`);
    // });

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
      setWaitingOponents(false);
    });

    socket.on("game_found", (data) => {
      setGameId(data.game_id);
      setMyPlayerId(data.player_id);
      setMessages(data.message);

      // Cuando se encuentra la partida, mostramos las opciones de posicionamiento
      delete data.players[data.player_id];

      // setEnemigos(data.players); // Muestra el botón de aleatorio
      setShowManualPlacementPanel(false); // Asegura que el panel manual esté oculto inicialmente
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
      if (socket.id == player_attacked) {
        setMessages(`Tu oponente atacó (${x}, ${y}): ${result}`);
      } else {
        setMessages(
          `Atacaron al jugador ${player_attacked} (${x}, ${y}): ${result}`
        );
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
      setMessages(data.message);
      setIsMyTurn(false);
      setGameId(null);
      setMyPlayerId(null);
      setWaitingOponents(true);
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
      <div className="game-area-container">
        {/* Nuevo contenedor para el layout */}
        {showManualPlacementPanel && (
          <Barcos
            myBoard={myBoard}
            setMyBoard={setMyBoard}
            onPlacementDone={handleManualPlacementDone}
          />
        )}
        <div className="board-and-controls-container">
          {/* Contiene tableros y botones */}
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
                isPlacingShipsManually={showManualPlacementPanel}
                setMyBoard={setMyBoard} // Permitir que Tablero actualice myBoard
              />
            </div>
            <div>
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
          </div>
          <div id="controls">
            {showPlaceShipsButton && (
              <>
                <button onClick={handlePlaceShipsRandomly}>
                  Posicionar Barcos Aleatoriamente
                </button>
                <button onClick={handleManualPlacement}>
                  Colocar Barcos Manualmente
                </button>
              </>
            )}

            {waitingOponents &&
              Object.keys(players).length > 1 &&
              isCreadorDeSala && (
                <button
                  onClick={() =>
                    socket.emit("force_start_game", { game_id: gameId })
                  }
                >
                  Comenzar Partida
                </button>
              )}

            {/* Si ya se está en modo manual, se puede añadir un botón de "Finalizar Colocación" aquí
                que llame a handleManualPlacementDone */}
            {showManualPlacementPanel && (
              <button onClick={() => handleManualPlacementDone(myBoard)}>
                Finalizar Colocación Manual
              </button>
            )}
          </div>
          <Arsenal
            arsenalSeleccionado={arsenalSeleccionado}
            setArsenalSeleccionado={setArsenalSeleccionado}
          />
        </div>
      </div>
    </div>
  );
}
