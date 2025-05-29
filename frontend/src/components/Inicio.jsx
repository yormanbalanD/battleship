import React from 'react';
import '../styles/inicio.css'

const Inicio = () => {
  const handleBuscarPartida = () => {
    alert('Buscando partida... ¡Entrando a una partida disponible!');
    // En una aplicación real, aquí usarías react-router-dom para navegar.
  };

  const handleCrearPartida = () => {
    let numPlayers = prompt('¿Hasta cuántos jugadores quieres en la partida? (Máximo 4)');
    numPlayers = parseInt(numPlayers, 10);

    if (isNaN(numPlayers) || numPlayers < 1 || numPlayers > 4) {
      alert('Número de jugadores no válido. Por favor, introduce un número entre 1 y 4.');
    } else {
      alert(`Creando una partida para ${numPlayers} jugadores. ¡Que empiece la diversión!`);
      // En una aplicación real, aquí enviarías esta información a tu backend y navegarías.
    }
  };

  return (
    <div className="inicio-container">
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