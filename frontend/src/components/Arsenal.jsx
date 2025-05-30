import React, { useState } from "react";

// Importa tus iconos PNG desde la carpeta 'src/icon/'
// Asegúrate de que las rutas sean correctas según donde estén tus archivos
import ArtilleriaIcon from "../icon/artilleria.png";
import RadarIcon from "../icon/radar.png";
import CazaIcon from "../icon/caza.png";
import AvionIcon from "../icon/chorro.png"; // ¡Aquí usamos 'chorro.png' para el avión!
import NukeIcon from "../icon/bomba-nuclear.png";

const ArsenalPanel = ({ arsenalSeleccionado, setArsenalSeleccionado }) => {
  // Array de objetos para definir cada tipo de arsenal
  const arsenales = [
    { id: "artilleria", name: "Artillería", icon: ArtilleriaIcon },
    { id: "radar", name: "Radar", icon: RadarIcon },
    { id: "caza", name: "Caza", icon: CazaIcon },
    { id: "avion", name: "Avión", icon: AvionIcon }, // Usa el icono importado para 'chorro.png'
    { id: "nuke", name: "Bomba Nuclear", icon: NukeIcon },
  ];

  // Función para manejar el clic en un botón de arsenal
  const handleSelectArsenal = (id) => {
    setArsenalSeleccionado(id);
    console.log(`Arsenal seleccionado: ${id}`); // Para ver el cambio en la consola
  };

  return (
    <div className="arsenal-panel-container">
      <h2>Selecciona tu Arsenal</h2>
      <div className="arsenal-buttons">
        {arsenales.map((arsenal) => (
          <button
            disabled={true}
            key={arsenal.id} // Siempre usa una key única en listas de React
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
