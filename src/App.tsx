import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/router";
import { PwaUpdate } from "./app/pwaUpdate";

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
      <PwaUpdate />
    </BrowserRouter>
  );
}
