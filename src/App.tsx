import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/router";
import { Toasts } from "./ui/Toasts";

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
      <Toasts />
    </BrowserRouter>
  );
}