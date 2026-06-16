import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Material = {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  stock_quantity: number;
  minimum_quantity: number;
  purchase_price: number | null;
  supplier: string | null;
  storage_location: string | null;
  is_active: boolean;
};

type Props = {
  tenantId: number;
  onBack: () => void;
};

export default function MaterialsPage({ tenantId, onBack }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Stk");
  const [category, setCategory] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [description, setDescription] = useState("");

  const loadMaterials = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Fehler beim Laden der Materialien:", error);
      setMessage("Materialien konnten nicht geladen werden.");
      setMaterials([]);
      setLoading(false);
      return;
    }

    setMaterials((data as Material[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMaterials();
  }, [tenantId]);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!name.trim()) {
      setMessage("Bitte Materialname eingeben.");
      return;
    }

    const { error } = await supabase.from("materials").insert({
      tenant_id: tenantId,
      name: name.trim(),
      unit: unit.trim() || "Stk",
      category: category.trim() || null,
      stock_quantity: Number(stockQuantity || 0),
      minimum_quantity: Number(minimumQuantity || 0),
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      supplier: supplier.trim() || null,
      storage_location: storageLocation.trim() || null,
      description: description.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Fehler beim Speichern des Materials:", error);
      setMessage("Material konnte nicht gespeichert werden.");
      return;
    }

    setName("");
    setUnit("Stk");
    setCategory("");
    setStockQuantity("0");
    setMinimumQuantity("0");
    setPurchasePrice("");
    setSupplier("");
    setStorageLocation("");
    setDescription("");

    setMessage("Material wurde gespeichert.");
    await loadMaterials();
  };

  return (
    <section className="single-page-section">
      <div className="card form-page-card">
        <div className="page-topbar">
          <div>
            <h2>Materialverwaltung</h2>
            <p>Materialstamm, Lagerbestand und Mindestbestand verwalten.</p>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Zurück zum Dashboard
          </button>
        </div>

        {message && <div className="message-box info">{message}</div>}

        <form onSubmit={handleCreateMaterial} className="form-stack">
          <h3>Neues Material anlegen</h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Materialname</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Innenfarbe Weiss 15L"
              />
            </div>

            <div className="form-group">
              <label>Einheit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Stk, Rolle, Eimer, Liter"
              />
            </div>

            <div className="form-group">
              <label>Kategorie</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Farbe, Werkzeug, Abdeckung"
              />
            </div>

            <div className="form-group">
              <label>Lagerbestand</label>
              <input
                type="number"
                step="0.01"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Mindestbestand</label>
              <input
                type="number"
                step="0.01"
                value={minimumQuantity}
                onChange={(e) => setMinimumQuantity(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Einkaufspreis</label>
              <input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="z. B. 69.90"
              />
            </div>

            <div className="form-group">
              <label>Lieferant</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="z. B. Brillux"
              />
            </div>

            <div className="form-group">
              <label>Lagerort</label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="z. B. Lager A"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bemerkung zum Material"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Material speichern
          </button>
        </form>

        <div className="table-wrapper" style={{ marginTop: 28 }}>
          <table className="orders-table orders-table-wide">
            <thead>
              <tr>
                <th>Material</th>
                <th>Kategorie</th>
                <th>Bestand</th>
                <th>Mindestbestand</th>
                <th>Einheit</th>
                <th>Lieferant</th>
                <th>Lagerort</th>
                <th>Preis</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>Materialien werden geladen...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={9}>Noch keine Materialien vorhanden.</td>
                </tr>
              ) : (
                materials.map((material) => {
                  const lowStock =
                    Number(material.stock_quantity) <=
                    Number(material.minimum_quantity);

                  return (
                    <tr key={material.id}>
                      <td>
                        <strong>{material.name}</strong>
                        <div className="table-subtitle">
                          {material.description || ""}
                        </div>
                      </td>
                      <td>{material.category || "-"}</td>
                      <td>
                        <strong style={{ color: lowStock ? "#b91c1c" : undefined }}>
                          {material.stock_quantity}
                        </strong>
                      </td>
                      <td>{material.minimum_quantity}</td>
                      <td>{material.unit}</td>
                      <td>{material.supplier || "-"}</td>
                      <td>{material.storage_location || "-"}</td>
                      <td>
                        {material.purchase_price !== null
                          ? `${material.purchase_price} CHF`
                          : "-"}
                      </td>
                      <td>{material.is_active ? "Aktiv" : "Inaktiv"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}