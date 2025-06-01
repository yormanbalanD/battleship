// Tablero.jsx
import React from "react";
import '../styles/tablero.css'; // Asegúrate de tener un archivo CSS para Tablero

// RowTablero sigue siendo un componente interno. Lo movemos dentro de Tablero si es pequeño
// o lo mantenemos separado si es complejo. Para este ejemplo, lo dejaremos separado para claridad
// pero lo pasaríamos como prop al Tablero principal si la lógica creciera mucho.

function Cell({
    cellData, // El valor de la celda (E, S, X, M)
    colIndex,
    rowIndex,
    isMyBoard,
    isMyTurn,
    clickHandler, // Para ataques
    arsenalSeleccionado,
    casillaApuntada,
    setCasillaApuntada,
    // Nuevas props para colocación manual
    isPlacingShipsManually,
    setMyBoard,
    draggingShip, // El barco que se está arrastrando desde Barcos.jsx
    setDraggingShip, // Para limpiar el barco después de soltarlo
}) {
    let cellClass = "cell";
    if (isMyBoard) {
        if (cellData === "S") cellClass += " ship";
        if (cellData === "L") cellClass += " looked";
        if (cellData === "X") cellClass += " hit"; // Tu barco golpeado
        if (cellData === "M") cellClass += " miss"; // Tu casilla fallada
    } else {
        if (cellData === "X") cellClass += " hit"; // Oponente golpeado
        if (cellData === "M") cellClass += " miss"; // Oponente fallado
        if (isMyTurn && cellData === "E") cellClass += " targettable"; // Solo atacable si es tu turno y no ha sido atacada
    }

    // Lógica para resaltar celdas en modo de ataque (existente)
    const isInRange = (xCell, yCell, type) => {
        // ... tu lógica existente para isInRange
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

    // --- Lógica para Resaltar Celdas de Colocación Manual ---
    const [isHoveringShip, setIsHoveringShip] = React.useState(false);

    const getShipPreviewCells = React.useCallback(() => {
        if (!isPlacingShipsManually || !draggingShip || !casillaApuntada) {
            return [];
        }

        const { size, orientation } = draggingShip;
        const startRow = casillaApuntada.row;
        const startCol = casillaApuntada.col;
        const previewCells = [];
        let canPlace = true;

        for (let i = 0; i < size; i++) {
            let r = startRow;
            let c = startCol;

            if (orientation === 'horizontal') {
                c += i;
            } else { // vertical
                r += i;
            }

            // Check boundaries
            if (r < 0 || r >= 10 || c < 0 || c >= 10) {
                canPlace = false;
                break;
            }
            // Check if cell is empty
            if (isMyBoard && myBoard[r][c] !== 'E') { // myBoard comes from parent Tablero props now
                 canPlace = false;
                 break;
            }

            // Check for adjacent ships for the 'no touching' rule
            // This is a more robust check for manual placement
            const hasAdjacent = (board, x, y) => {
                const neighbors = [
                    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
                    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                    { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
                ];
                for (const neighbor of neighbors) {
                    const nx = x + neighbor.dx;
                    const ny = y + neighbor.dy;
                    if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && board[ny][nx] === 'S') {
                        return true;
                    }
                }
                return false;
            };

            // Temporarily mark cells as 'S' to check adjacency correctly for *this* ship
            // This requires a deep copy of myBoard and a more complex check
            // For simplicity, we'll check against the current board state only
            if (isMyBoard && hasAdjacent(myBoard, c, r)) { // Check if cell is adjacent to an existing ship
                 canPlace = false;
                 break;
            }


            previewCells.push({ r, c });
        }

        if (canPlace) {
            return previewCells;
        }
        return [];

    }, [isPlacingShipsManually, draggingShip, casillaApuntada, isMyBoard]);


    const isCellPartOfPreview = (row, col) => {
        const previewCells = getShipPreviewCells();
        return previewCells.some(cell => cell.r === row && cell.c === col);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Permite el drop
        if (isMyBoard && isPlacingShipsManually && draggingShip) {
            // Actualiza la casilla apuntada para la previsualización
            setCasillaApuntada({ row: rowIndex, col: colIndex });
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (isMyBoard && isPlacingShipsManually && draggingShip) {
            // Recupera los datos del barco que se está arrastrando
            const shipData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const { shipId, shipSize, orientation } = shipData;

            const startRow = rowIndex;
            const startCol = colIndex;

            // Función para verificar si la colocación es válida (límites, vacío, no adyacente)
            const isValidPlacement = (board, size, orient, sRow, sCol) => {
                for (let i = 0; i < size; i++) {
                    let r = sRow;
                    let c = sCol;
                    if (orient === 'horizontal') c += i;
                    else r += i;

                    if (r < 0 || r >= 10 || c < 0 || c >= 10 || board[r][c] !== 'E') {
                        return false; // Fuera de límites o celda ya ocupada
                    }

                    // Check adjacency for each segment of the potential ship
                    const neighbors = [
                        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
                        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                        { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
                    ];
                    for (const neighbor of neighbors) {
                        const nx = c + neighbor.dx;
                        const ny = r + neighbor.dy;
                        if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && board[ny][nx] === 'S') {
                            return false; // Adyacente a otro barco ya colocado
                        }
                    }
                }
                return true;
            };

            const newBoard = JSON.parse(JSON.stringify(myBoard)); // Crea una copia para modificar

            if (isValidPlacement(newBoard, shipSize, orientation, startRow, startCol)) {
                for (let i = 0; i < shipSize; i++) {
                    let r = startRow;
                    let c = startCol;
                    if (orientation === 'horizontal') c += i;
                    else r += i;
                    newBoard[r][c] = 'S';
                }
                setMyBoard(newBoard); // Actualiza el tablero en Partida.jsx
                // Notifica al componente Barcos que este barco ha sido colocado
                // Esto requeriría una prop adicional en Barcos.jsx para manejarlo
                // Por ahora, el estado de shipsToPlace se gestiona en Barcos.jsx directamente
            } else {
                alert("No se puede colocar el barco aquí. Asegúrate de que haya espacio y no toque otros barcos.");
            }

            setDraggingShip(null); // Limpiar el barco arrastrado
            setCasillaApuntada(null); // Limpiar la previsualización
        }
    };


    return (
        <div
            key={`${rowIndex}-${colIndex}`}
            className={`${cellClass} ${isCellPartOfPreview(rowIndex, colIndex) ? 'ship-preview' : ''}`}
            onClick={
              clickHandler ? () => clickHandler(colIndex, rowIndex, player_sid) : null
            }
            style={{
                backgroundColor: isInRange(rowIndex, colIndex, cellData)
                    ? "#ffc107"
                    : (isCellPartOfPreview(rowIndex, colIndex) ? 'rgba(0, 255, 0, 0.5)' : null), // Green for preview
            }}
            onMouseEnter={() => {
                // Solo actualiza casillaApuntada si no estamos en modo de colocación manual arrastrando
                if (!isPlacingShipsManually || !draggingShip) {
                    setCasillaApuntada({
                        row: rowIndex,
                        col: colIndex,
                    });
                }
            }}
            onMouseLeave={() => {
                if (!isPlacingShipsManually || !draggingShip) {
                    setCasillaApuntada(null);
                }
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Opcional: mostrar un icono o letra para el estado */}
            {cellData === "X" ? "❌" : cellData === "M" ? "💧" : ""}
        </div>
    );
}

export default function Tablero({
    dataTablero,
    isMyBoard = false,
    isMyTurn,
    clickHandler,
    arsenalSeleccionado,
  player_sid
    // Nuevas props para colocación manual
    isPlacingShipsManually,
    setMyBoard, // Pasar setMyBoard al Tablero
}) {
    const [casillaApuntada, setCasillaApuntada] = React.useState(null);
    const [draggingShip, setDraggingShip] = React.useState(null); // Estado para el barco siendo arrastrado

    // useCallback para evitar recrear la función innecesariamente.
    // Esto es vital para el drag-and-drop del barco
    const handleDragStartFromPanel = React.useCallback((e) => {
        // Obtenemos los datos del barco desde Barcos.jsx
        const shipData = JSON.parse(e.dataTransfer.getData('text/plain'));
        setDraggingShip(shipData);
    }, []);

    const handleDragEndFromPanel = React.useCallback(() => {
        setDraggingShip(null); // Limpiar el barco después de soltarlo
        setCasillaApuntada(null); // Limpiar la previsualización
    }, []);


    return (
        <div
            className="board"
            onMouseLeave={() => {
                setCasillaApuntada(null);
                if (isPlacingShipsManually) setDraggingShip(null); // Limpiar drag si sales del tablero en modo manual
            }}
            onDragOver={(e) => {
                e.preventDefault(); // Necesario para permitir drops
                if (isPlacingShipsManually && draggingShip) {
                    // Si estamos arrastrando un barco y es nuestro tablero, actualizamos la casilla apuntada para la previsualización
                    const rect = e.currentTarget.getBoundingClientRect();
                    const cellSize = rect.width / dataTablero[0].length; // Asume un tablero cuadrado
                    const x = Math.floor((e.clientX - rect.left) / cellSize);
                    const y = Math.floor((e.clientY - rect.top) / cellSize);
                    setCasillaApuntada({ row: y, col: x });
                }
            }}
            onDrop={(e) => {
                e.preventDefault();
                // Esta función handleDrop se manejará por cada `Cell` directamente
                // Pero el `onDrop` del tablero padre es importante para evitar que el drop ocurra si no se suelta en una celda específica
            }}
            onDragEnter={(e) => e.preventDefault()} // Importante para que onDragOver se dispare
        >
            {dataTablero.map((row, rowIndex) => (
                <div className="board-row" key={rowIndex}>
                    {row.map((cellData, colIndex) => (
                        <Cell
                            key={`${rowIndex}-${colIndex}`}
                            cellData={cellData}
                            colIndex={colIndex}
                            rowIndex={rowIndex}
                            isMyBoard={isMyBoard}
                            isMyTurn={isMyTurn}
                            clickHandler={clickHandler}
                            arsenalSeleccionado={arsenalSeleccionado}
                            casillaApuntada={casillaApuntada}
                            setCasillaApuntada={setCasillaApuntada}
          player_sid={player_sid}
                            // Props para colocación manual
                            isPlacingShipsManually={isPlacingShipsManually}
                            setMyBoard={setMyBoard} // Pasar la función de actualización del tablero
                            draggingShip={draggingShip} // Pasar el estado del barco arrastrado
                            setDraggingShip={setDraggingShip} // Permitir a la celda limpiar el barco
                            myBoard={dataTablero} // Necesita el tablero actual para validaciones de adyacencia
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}