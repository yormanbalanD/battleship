import React from "react";

function RowTablero({
  isMyBoard,
  clickHandler = null,
  isMyTurn,
  row,
  rowIndex,
  casillaApuntada,
  setCasillaApuntada,
  arsenalSeleccionado,
}) {
  /*background-color: #ffc107;
    border-color: #ffb300; */

  const isInRange = (xCell, yCell, type) => {
    if (casillaApuntada == null || !isMyTurn || type != "E") {
      return false;
    }
    if (
      arsenalSeleccionado === "artilleria" &&
      xCell == casillaApuntada.row &&
      yCell == casillaApuntada.col
    ) {
      return true;
    }

    if (
      arsenalSeleccionado === "radar" &&
      xCell > casillaApuntada.row - 2 &&
      xCell < casillaApuntada.row + 2 &&
      yCell > casillaApuntada.col - 2 &&
      yCell < casillaApuntada.col + 2
    ) {
      return true;
    }

    if (arsenalSeleccionado === "avion") {
      const filaCentro = casillaApuntada.row;
      const columnaCentro = casillaApuntada.col;
      const brazoCruz = 2; // Un brazo de 1 significa el centro + 1 casilla en cada dirección

      // Rangos para el brazo horizontal
      const columna_min_h = columnaCentro - brazoCruz;
      const columna_max_h = columnaCentro + brazoCruz;

      // Rangos para el brazo vertical
      const fila_min_v = filaCentro - brazoCruz;
      const fila_max_v = filaCentro + brazoCruz;

      // Verificar si la casilla está en el brazo horizontal
      const enBrazoHorizontal =
        xCell === filaCentro &&
        yCell >= columna_min_h &&
        yCell <= columna_max_h;

      // Verificar si la casilla está en el brazo vertical
      const enBrazoVertical =
        yCell === columnaCentro && xCell >= fila_min_v && xCell <= fila_max_v;

      const esEsquinaDiagonal =
        (xCell === filaCentro - 1 && yCell === columnaCentro - 1) || // Esquina superior izquierda
        (xCell === filaCentro - 1 && yCell === columnaCentro + 1) || // Esquina superior derecha
        (xCell === filaCentro + 1 && yCell === columnaCentro - 1) || // Esquina inferior izquierda
        (xCell === filaCentro + 1 && yCell === columnaCentro + 1);

      // Si está en el brazo horizontal O en el brazo vertical, está en la cruz
      if (enBrazoHorizontal || enBrazoVertical || esEsquinaDiagonal) {
        return true;
      }
    }

    if (
      arsenalSeleccionado === "caza" &&
      xCell > casillaApuntada.row - 3 &&
      xCell < casillaApuntada.row + 3 &&
      yCell > casillaApuntada.col - 1 &&
      yCell < casillaApuntada.col + 1
    ) {
      return true;
    }

    if (arsenalSeleccionado === "nuke") {
      return true;
    }

    return false;
  };

  return (
    <div className="board-row">
      {row.map((cell, colIndex) => {
        let cellClass = "cell";
        if (isMyBoard) {
          if (cell === "S") cellClass += " ship";
          if (cell === "L") cellClass += " looked";
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
            style={{
              backgroundColor: isInRange(rowIndex, colIndex, cell)
                ? "#ffc107"
                : null,
            }}
            onMouseEnter={() => {
              setCasillaApuntada({
                row: rowIndex,
                col: colIndex,
              });
            }}
          >
            {/* Opcional: mostrar un icono o letra para el estado */}
            {cell === "X" ? "❌" : cell === "M" ? "💧" : ""}
          </div>
        );
      })}
    </div>
  );
}

export default function Tablero({
  dataTablero,
  isMyBoard = false,
  isMyTurn,
  clickHandler,
  arsenalSeleccionado,
}) {
  const [casillaApuntada, setCasillaApuntada] = React.useState(null);

  return (
    <div className="board" onMouseLeave={() => setCasillaApuntada(null)}>
      {dataTablero.map((row, rowIndex) => (
        <RowTablero
          isMyBoard={isMyBoard}
          clickHandler={clickHandler}
          isMyTurn={isMyTurn}
          row={row}
          rowIndex={rowIndex}
          key={rowIndex}
          arsenalSeleccionado={arsenalSeleccionado}
          casillaApuntada={casillaApuntada}
          setCasillaApuntada={setCasillaApuntada}
        />
      ))}
    </div>
  );
}
