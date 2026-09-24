import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installUiFrames } from "./art/ui";
import App from "./App";
import "./styles.css";

installUiFrames();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
