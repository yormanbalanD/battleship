// src/App.jsx
import { useState } from "react";
import "./App.css"; // Para estilos básicos
import Arsenal from "./components/Arsenal";
import Inicio from "./components/Inicio";
import Partida from "./components/Partida";
import { ToastContainer } from "react-toastify";
import { socket } from "./socket";
import { useEffect } from "react";

function App() {
  const [pagina, setPagina] = useState("inicio");
  const [isCreadorDeSala, setIsCreadorDeSala] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const [myPlayerId, setMyPlayerId] = useState(socket.id);

  useEffect(() => {
    socket.on("connect", () => {
      setMyPlayerId(socket.id);
      console.log(socket.id);
      console.log("Conectado al servidor.");
    });

    socket.on("disconnect", () => {
      console.log("Desconectado del servidor.", "red");
    });
  });

  if (pagina === "inicio") {
    return (
      <Inicio
        setPagina={setPagina}
        setIsCreadorDeSala={setIsCreadorDeSala}
        setMaxPlayers={setMaxPlayers}
      />
    );
  }

  return (
    <>
      <ToastContainer />
      <Partida
        isCreadorDeSala={isCreadorDeSala}
        setPagina={setPagina}
        maxPlayers={maxPlayers}
        myPlayerId={myPlayerId}
      />
    </>
  );
}

export default App;
