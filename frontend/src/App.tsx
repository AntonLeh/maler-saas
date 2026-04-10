import { useEffect, useState } from "react";
import "./App.css";

type Customer = {
  id: number;
  company_id: number;
  user_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Order = {
  id: number;
  company_id: number;
  customer_id: number;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

type ProgressEntry = {
  id: number;
  company_id: number;
  order_id: number;
  user_id: number;
  status: string;
  note: string | null;
  created_at: string;
};

function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [orderData, setOrderData] = useState({
    company_id: 1,
    customer_id: 0,
    title: "",
    description: "",
    status: "neu",
    address_street: "",
    address_zip: "",
    address_city: "",
    created_by: 1,
  });

  const [progressData, setProgressData] = useState({
    company_id: 1,
    order_id: 1,
    user_id: 2,
    status: "in_arbeit",
    note: "",
  });

  const [orderMessage, setOrderMessage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrderProgress, setSelectedOrderProgress] = useState<
    ProgressEntry[]
  >([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrderData({
      ...orderData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProgressChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setProgressData({
      ...progressData,
      [e.target.name]:
        e.target.name === "order_id" ||
        e.target.name === "company_id" ||
        e.target.name === "user_id"
          ? Number(e.target.value)
          : e.target.value,
    });
  };

  async function loadCustomers() {
    try {
      setLoadingCustomers(true);
      const response = await fetch("http://localhost:3000/customers");
      const data = await response.json();

      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        console.error("Kunden-Antwort ist kein Array:", data);
        setCustomers([]);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Kunden:", error);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function loadOrders() {
    try {
      setLoadingOrders(true);
      const response = await fetch("http://localhost:3000/orders");
      const data = await response.json();

      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        console.error("Auftrags-Antwort ist kein Array:", data);
        setOrders([]);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Aufträge:", error);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadProgressForOrder(orderId: number) {
    try {
      setLoadingProgress(true);
      const response = await fetch(
        `http://localhost:3000/orders/${orderId}/progress`
      );
      const data = await response.json();

      if (Array.isArray(data)) {
        setSelectedOrderProgress(data);
      } else {
        console.error("Fortschritts-Antwort ist kein Array:", data);
        setSelectedOrderProgress([]);
      }
    } catch (error) {
      console.error("Fehler beim Laden des Fortschritts:", error);
      setSelectedOrderProgress([]);
    } finally {
      setLoadingProgress(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    loadOrders();
  }, []);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderMessage("");

    if (orderData.customer_id === 0) {
      setOrderMessage("❌ Bitte Kunde auswählen");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Fehler beim Speichern des Auftrags");
      }

      setOrderMessage("✅ Auftrag gespeichert!");
      setOrderData({
        company_id: 1,
        customer_id: 0,
        title: "",
        description: "",
        status: "neu",
        address_street: "",
        address_zip: "",
        address_city: "",
        created_by: 1,
      });

      loadOrders();
    } catch (error: unknown) {
      if (error instanceof Error) {
        setOrderMessage("❌ Fehler: " + error.message);
      } else {
        setOrderMessage("❌ Unbekannter Fehler");
      }
    }
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProgressMessage("");

    try {
      const response = await fetch(
        `http://localhost:3000/orders/${progressData.order_id}/progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(progressData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Fehler beim Speichern des Fortschritts"
        );
      }

      setProgressMessage("✅ Fortschritt gespeichert!");

      if (selectedOrderId === progressData.order_id) {
        loadProgressForOrder(progressData.order_id);
      }

      setProgressData({
        company_id: 1,
        order_id: 1,
        user_id: 2,
        status: "in_arbeit",
        note: "",
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setProgressMessage("❌ Fehler: " + error.message);
      } else {
        setProgressMessage("❌ Unbekannter Fehler");
      }
    }
  };

  function getCustomerName(customerId: number) {
    const customer = customers.find((customer) => customer.id === customerId);

    if (!customer) {
      return "Unbekannter Kunde";
    }

    return `${customer.first_name} ${customer.last_name}`;
  }

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
      <h1>MalerSaaS – Admin Testoberfläche</h1>

      <section style={{ marginBottom: "50px" }}>
        <h2>Auftrag anlegen</h2>

        <form onSubmit={handleOrderSubmit}>
          <select
            name="customer_id"
            value={orderData.customer_id}
            onChange={(e) =>
              setOrderData({
                ...orderData,
                customer_id: Number(e.target.value),
              })
            }
          >
            <option value={0}>Kunde auswählen</option>
            {Array.isArray(customers) &&
              customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name}
                </option>
              ))}
          </select>

          <br />
          <br />

          <input
            name="title"
            placeholder="Titel"
            value={orderData.title}
            onChange={handleOrderChange}
          />
          <br />
          <br />

          <input
            name="description"
            placeholder="Beschreibung"
            value={orderData.description}
            onChange={handleOrderChange}
          />
          <br />
          <br />

          <input
            name="address_street"
            placeholder="Straße"
            value={orderData.address_street}
            onChange={handleOrderChange}
          />
          <br />
          <br />

          <input
            name="address_zip"
            placeholder="PLZ"
            value={orderData.address_zip}
            onChange={handleOrderChange}
          />
          <br />
          <br />

          <input
            name="address_city"
            placeholder="Ort"
            value={orderData.address_city}
            onChange={handleOrderChange}
          />
          <br />
          <br />

          <button type="submit">Auftrag speichern</button>
        </form>

        <p>{orderMessage}</p>
      </section>

      <section style={{ marginBottom: "50px" }}>
        <h2>Fortschritt hinzufügen</h2>

        <form onSubmit={handleProgressSubmit}>
          <input
            type="number"
            name="order_id"
            placeholder="Auftrag-ID"
            value={progressData.order_id}
            onChange={handleProgressChange}
          />
          <br />
          <br />

          <input
            name="status"
            placeholder="Status"
            value={progressData.status}
            onChange={handleProgressChange}
          />
          <br />
          <br />

          <textarea
            name="note"
            placeholder="Notiz"
            value={progressData.note}
            onChange={handleProgressChange}
            rows={4}
          />
          <br />
          <br />

          <button type="submit">Fortschritt speichern</button>
        </form>

        <p>{progressMessage}</p>
      </section>

      <section style={{ marginBottom: "50px" }}>
        <h2>Kundenliste</h2>

        {loadingCustomers ? (
          <p>Kunden werden geladen...</p>
        ) : !Array.isArray(customers) || customers.length === 0 ? (
          <p>Keine Kunden gefunden oder Fehler beim Laden.</p>
        ) : (
          <div>
            {customers.map((customer) => (
              <div
                key={customer.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "15px",
                  marginBottom: "12px",
                  background: "#fff",
                }}
              >
                <strong>
                  #{customer.id} – {customer.first_name} {customer.last_name}
                </strong>

                <p>E-Mail: {customer.email || "-"}</p>
                <p>Telefon: {customer.phone || "-"}</p>
                <p>
                  Adresse: {customer.street || "-"}, {customer.zip || "-"}{" "}
                  {customer.city || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: "50px" }}>
        <h2>Auftragsliste</h2>

        {loadingOrders ? (
          <p>Aufträge werden geladen...</p>
        ) : !Array.isArray(orders) || orders.length === 0 ? (
          <p>Keine Aufträge gefunden oder Fehler beim Laden.</p>
        ) : (
          <div>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  border:
                    selectedOrderId === order.id
                      ? "2px solid #1f6feb"
                      : "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "15px",
                  marginBottom: "12px",
                  background: "#fff",
                }}
              >
                <strong>
                  #{order.id} – {order.title}
                </strong>
                <p>Beschreibung: {order.description || "-"}</p>
                <p>Status: {order.status}</p>
                <p>Kunde: {getCustomerName(order.customer_id)}</p>
                <p>
                  Adresse: {order.address_street || "-"},{" "}
                  {order.address_zip || "-"} {order.address_city || "-"}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    loadProgressForOrder(order.id);
                  }}
                >
                  Auftrag auswählen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "50px" }}>
        <h2>Fortschritt des ausgewählten Auftrags</h2>

        {selectedOrderId === null ? (
          <p>Bitte einen Auftrag aus der Liste auswählen.</p>
        ) : loadingProgress ? (
          <p>Fortschritt wird geladen...</p>
        ) : !Array.isArray(selectedOrderProgress) ||
          selectedOrderProgress.length === 0 ? (
          <p>Für diesen Auftrag gibt es noch keinen Fortschritt.</p>
        ) : (
          <div>
            <p>
              <strong>Ausgewählter Auftrag:</strong> #{selectedOrderId}
            </p>

            {selectedOrderProgress.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "15px",
                  marginBottom: "12px",
                  background: "#fff",
                }}
              >
                <p>
                  <strong>Status:</strong> {entry.status}
                </p>
                <p>
                  <strong>Notiz:</strong> {entry.note || "-"}
                </p>
                <p>
                  <strong>User-ID:</strong> {entry.user_id}
                </p>
                <p>
                  <strong>Zeitpunkt:</strong>{" "}
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;