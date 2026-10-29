import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "./app/theme.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
