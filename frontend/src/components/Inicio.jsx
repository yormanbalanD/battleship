import React from "react";
import "../styles/inicio.css";
import cargar from "../icon/cargando-flechas.png";
import { socket } from "../socket";

const Inicio = ({ setPagina, setIsCreadorDeSala, setMaxPlayers }) => {
  const handleBuscarPartida = () => {
    setPagina("partida");
  };

  const handleCrearPartida = () => {
    let numPlayers = prompt(
      "¿Hasta cuántos jugadores quieres en la partida? (Máximo 4)"
    );
    numPlayers = parseInt(numPlayers, 10);

    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 4) {
      alert(
        "Número de jugadores no válido. Por favor, introduce un número entre 2 y 4."
      );
    } else {
      alert(
        `Creando una partida para ${numPlayers} jugadores. ¡Que empiece la diversión!`
      );
      setMaxPlayers(numPlayers);
      setIsCreadorDeSala(true);
      setPagina("partida");
      // En una aplicación real, aquí enviarías esta información a tu backend y navegarías.
    }
  };

  return (
    <div className="inicio-container">
        <div
        
          style={{
            position: "absolute",
            top: "15px",
            left: "15px",
            backgroundColor: "blue",
            color: "white",
            display: "flex",
            padding: "5px 10px",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
          }}
          onClick={() => {
            socket.emit("restart_server");
          }}
        >
          <img style={{
          }} src={cargar} alt="Logo" width="35px" height="35px" />
          <h3>Reiniciar Datos Del Servidor</h3>
        </div>
      {/* Nuevo div para el panel */}
      <div className="panel">
        <h1 className="game-title">BATTLESHIP</h1>
        <div className="button-group">
          <button className="game-button" onClick={handleBuscarPartida}>
            BUSCAR PARTIDA
          </button>
          <button className="game-button" onClick={handleCrearPartida}>
            CREAR PARTIDA
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inicio;
