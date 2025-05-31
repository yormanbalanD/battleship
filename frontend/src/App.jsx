// src/App.jsx
import { useState } from "react";
import "./App.css"; // Para estilos básicos
import Arsenal from "./components/Arsenal";
import Inicio from "./components/Inicio";
import Partida from "./components/Partida";

function App() {
  const [pagina, setPagina] = useState("inicio");
  const [isCreadorDeSala, setIsCreadorDeSala] = useState(false);

  if (pagina === "inicio") {
    return <Inicio setPagina={setPagina} setIsCreadorDeSala={setIsCreadorDeSala} />;
  }

  return <Partida isCreadorDeSala={isCreadorDeSala} setPagina={setPagina} />;
}

export default App;
