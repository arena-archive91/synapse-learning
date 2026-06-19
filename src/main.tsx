import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { LearnerModelProvider } from "./store/LearnerModelContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LearnerModelProvider>
      <App />
    </LearnerModelProvider>
  </StrictMode>
);
