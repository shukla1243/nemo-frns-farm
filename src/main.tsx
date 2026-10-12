import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installUiFrames } from "./art/ui";
import { storedReducedMotion } from "./ui/common";
import App from "./App";
import "./styles.css";

installUiFrames();
document.documentElement.dataset.rm = storedReducedMotion() ? "1" : "0";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
