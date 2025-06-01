// src/App.jsx
import { useState } from "react";
import "./App.css"; // Para estilos básicos
import Arsenal from "./components/Arsenal";
import Inicio from "./components/Inicio";
import Partida from "./components/Partida";
import { ToastContainer } from "react-toastify";

function App() {
  const [pagina, setPagina] = useState("inicio");
  const [isCreadorDeSala, setIsCreadorDeSala] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);

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
      />
    </>
  );
}

export default App;
