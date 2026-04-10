import express from "express";
import cors from "cors";
import { errorMiddleware } from "./middleware/error.middleware";
import { supabase } from "./db/supabase";
import customersRoutes from "./modules/customers/customers.routes";
import ordersRoutes from "./modules/orders/orders.routes";
import progressRoutes from "./modules/progress/progress.routes";
import imagesRoutes from "./modules/images/images.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "MalerSaaS Backend läuft",
  });
});

app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase.from("companies").select("*");

  if (error) {
    return res.status(500).json({
      message: "Fehler beim Laden aus der Datenbank",
      error: error.message,
    });
  }

  res.json(data);
});

app.use("/customers", customersRoutes);
app.use("/orders", ordersRoutes);
app.use("/orders", progressRoutes);
app.use("/orders", imagesRoutes);

app.use(errorMiddleware);

export default app;