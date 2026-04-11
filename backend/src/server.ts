import app from "./app";
import { env } from "./config/env";

const PORT = process.env.PORT || env.port || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend läuft auf Port ${PORT}`);
});