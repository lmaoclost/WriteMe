import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/router";
import { PwaUpdate } from "./app/pwaUpdate";
import { requestPersistentStorage } from "./data/persistence";

export default function App() {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <BrowserRouter>
      <AppRouter />
      <PwaUpdate />
    </BrowserRouter>
  );
}
