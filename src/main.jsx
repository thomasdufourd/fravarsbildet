import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Regelmotor from "./regelmotor.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Regelmotor />
  </StrictMode>
);
