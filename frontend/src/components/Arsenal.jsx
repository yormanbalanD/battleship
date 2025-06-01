import React, { useState } from "react";

// Importa tus iconos PNG desde la carpeta 'src/icon/'
// Asegúrate de que las rutas sean correctas según donde estén tus archivos
import ArtilleriaIcon from "../icon/artilleria.png";
import RadarIcon from "../icon/radar.png";
import CazaIcon from "../icon/caza.png";
import AvionIcon from "../icon/chorro.png"; // ¡Aquí usamos 'chorro.png' para el avión!
import NukeIcon from "../icon/bomba-nuclear.png";

const ArsenalPanel = ({
  arsenalSeleccionado,
  setArsenalSeleccionado,
  playerPoints,
}) => {
  // Array de objetos para definir cada tipo de arsenal
  const arsenales = [
    { id: "artilleria", name: "Artillería", icon: ArtilleriaIcon, points: 0 },
    { id: "radar", name: "Radar", icon: RadarIcon, points: 2 },
    { id: "caza", name: "Caza", icon: CazaIcon, points: 7 },
    { id: "avion", name: "Avión", icon: AvionIcon, points: 7 }, // Usa el icono importado para 'chorro.png'
    { id: "nuke", name: "Bomba Nuclear", icon: NukeIcon, points: 10 },
  ];

  // Función para manejar el clic en un botón de arsenal
  const handleSelectArsenal = (id) => {
    setArsenalSeleccionado(id);
    console.log(`Arsenal seleccionado: ${id}`); // Para ver el cambio en la consola
  };

  return (
    <div className="arsenal-panel-container">
      <h2>Selecciona tu Arsenal (Tus Puntos: {playerPoints})</h2>
      <div className="arsenal-buttons">
        {arsenales.map((arsenal) => (
          <div key={arsenal.id}>
            <span>Puntos: {arsenal.points}</span>
            <button
              disabled={playerPoints < arsenal.points}
              className={`arsenal-button ${
                arsenalSeleccionado === arsenal.id ? "selected" : ""
              }`}
              onClick={() => handleSelectArsenal(arsenal.id)}
            >
              {/* Usar la etiqueta <img> para los PNG importados */}
              <img
                src={arsenal.icon}
                alt={arsenal.name}
                className="arsenal-icon"
              />
              <span className="arsenal-name">{arsenal.name}</span>
            </button>
          </div>
        ))}
      </div>
      {arsenalSeleccionado && (
        <p className="selected-info">
          Has seleccionado:{" "}
          <span className="selected-item">
            {arsenalSeleccionado.toUpperCase()}
          </span>
        </p>
      )}
    </div>
  );
};

export default ArsenalPanel;
