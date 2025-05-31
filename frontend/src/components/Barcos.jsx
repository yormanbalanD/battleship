// Barcos.jsx
import React, { useState } from 'react';
import '../styles/barcos.css'; // Archivo CSS para el panel de barcos

// Importa tus imágenes aquí
import ship5Icon from '../icon/ship5.png'; // Asegúrate de que la ruta sea correcta
import ship4Icon from '../icon/ship4.png';
import ship3aIcon from '../icon/ship3.png';
import ship3bIcon from '../icon/ship3.png';
import ship2Icon from '../icon/ship2.png';

const shipDefinitions = [
    { id: 'ship-5', size: 5, count: 1, icon: ship5Icon },
    { id: 'ship-4', size: 4, count: 1, icon: ship4Icon },
    { id: 'ship-3a', size: 3, count: 1, icon: ship3aIcon }, // Primer barco de 3
    { id: 'ship-3b', size: 3, count: 1, icon: ship3bIcon }, // Segundo barco de 3
    { id: 'ship-2', size: 2, count: 1, icon: ship2Icon },
];

export default function Barcos({ myBoard, setMyBoard, onPlacementDone }) {
    const [shipsToPlace, setShipsToPlace] = useState(shipDefinitions);
    const [draggingShip, setDraggingShip] = useState(null); // { id: 'ship-X', size: Y, orientation: 'horizontal' }
    const [currentOrientation, setCurrentOrientation] = useState('horizontal'); // 'horizontal' o 'vertical'

    const handleDragStart = (e, shipId, shipSize) => {
        // Guardamos el barco que se está arrastrando y su orientación
        setDraggingShip({ id: shipId, size: shipSize, orientation: currentOrientation });
        // Datos que se transferirán con el drag (útil para el drop)
        e.dataTransfer.setData('text/plain', JSON.stringify({ shipId, shipSize, orientation: currentOrientation }));
    };

    const handleDragEnd = () => {
        setDraggingShip(null); // Limpiar el barco que se estaba arrastrando
    };

    const rotateShip = () => {
        setCurrentOrientation(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    };

    // Función para manejar la colocación final de un barco en el tablero
    const placeShipOnBoard = (board, ship, startRow, startCol) => {
        const newBoard = JSON.parse(JSON.stringify(board));
        const { size, id, orientation } = ship;

        let canPlace = true;
        const cellsToOccupy = [];

        for (let i = 0; i < size; i++) {
            let r = startRow;
            let c = startCol;

            if (orientation === 'horizontal') {
                c += i;
            } else { // vertical
                r += i;
            }

            if (r < 0 || r >= 10 || c < 0 || c >= 10 || newBoard[r][c] !== 'E') {
                canPlace = false;
                break;
            }
            cellsToOccupy.push({ r, c });
        }

        if (canPlace) {
            cellsToOccupy.forEach(({ r, c }) => {
                newBoard[r][c] = 'S'; // 'S' de Ship
            });

            setShipsToPlace(prevShips =>
                prevShips.map(s =>
                    s.id === id ? { ...s, count: s.count - 1 } : s
                )
            );
            return newBoard; // Devolvemos el tablero actualizado
        }
        return board; // Si no se pudo colocar, devolvemos el tablero original
    };


    return (
        <div className="manual-placement-panel">
            <h2>Colocar Barcos</h2>
            <div className="ship-orientation">
                <button onClick={rotateShip}>Rotar Barco ({currentOrientation === 'horizontal' ? 'Horizontal' : 'Vertical'})</button>
            </div>
            <div className={`ships-list ${currentOrientation === 'vertical' ? 'vertical-layout' : ''}`}>
                {shipsToPlace.map(ship => (
                    ship.count > 0 && (
                        <div
                            key={ship.id}
                            className={`ship-icon ${currentOrientation}`}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, ship.id, ship.size)}
                            onDragEnd={handleDragEnd}
                            style={{
                                // These styles control the *container* of the image
                                width: currentOrientation === 'horizontal' ? `${ship.size * 40}px` : '40px', // Asumiendo 40px por celda
                                height: currentOrientation === 'vertical' ? `${ship.size * 40}px` : '40px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                border: '1px solid #ccc',
                                cursor: 'grab',
                                userSelect: 'none',
                                backgroundColor: '#555',
                            }}
                        >
                            <img
                                src={ship.icon}
                                alt={`Barco de tamaño ${ship.size}`}
                                className="ship-image"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    // ADD THIS LINE TO ROTATE THE IMAGE
                                    transform: currentOrientation === 'vertical' ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s ease-in-out', // Smooth transition for rotation
                                }}
                            />
                        </div>
                    )
                ))}
            </div>
            {shipsToPlace.every(ship => ship.count === 0) && (
                <button
                    className="finish-placement-button"
                    onClick={() => onPlacementDone(myBoard)}
                >
                    Confirmar Barcos
                </button>
            )}
        </div>
    );
}