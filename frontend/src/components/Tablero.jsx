import React from "react";

export default function Tablero({
  isMyBoard,
  clickHandler = null,
  isMyTurn,
  row,
  rowIndex,
}) {
  return (
    <div className="board-row">
      {row.map((cell, colIndex) => {
        let cellClass = "cell";
        if (isMyBoard) {
          if (cell === "S") cellClass += " ship";
          if (cell === "X") cellClass += " hit"; // Tu barco golpeado
          if (cell === "M") cellClass += " miss"; // Tu casilla fallada
        } else {
          if (cell === "X") cellClass += " hit"; // Oponente golpeado
          if (cell === "M") cellClass += " miss"; // Oponente fallado
          if (isMyTurn && cell === "E") cellClass += " targettable"; // Solo atacable si es tu turno y no ha sido atacada
        }

        return (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={cellClass}
            onClick={
              clickHandler ? () => clickHandler(colIndex, rowIndex) : null
            }
          >
            {/* Opcional: mostrar un icono o letra para el estado */}
            {cell === "X" ? "❌" : cell === "M" ? "💧" : ""}
          </div>
        );
      })}
    </div>
  );
}
