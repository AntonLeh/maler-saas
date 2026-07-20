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
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [description, setDescription] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("Alle");

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

  const handleAddMaterialStock = async () => {
  setMessage("");

  if (editingMaterialId === null) {
    setMessage("Bitte zuerst ein Material auswählen oder speichern.");
    return;
  }

  const quantity = Number(purchaseQuantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    setMessage("Bitte eine gültige Menge größer als 0 eingeben.");
    return;
  }

  const { error: stockError } = await supabase.rpc(
    "book_material_stock",
    {
      p_material_id: editingMaterialId,
      p_movement_type: "purchase",

      p_quantity: quantity,

      p_from_holder_type: "supplier",
      p_from_holder_id: null,

      p_to_holder_type: "warehouse",
      p_to_holder_id: null,

      p_order_id: null,

      p_reference_type: "purchase",
      p_reference_id: editingMaterialId,

      p_note: "Wareneingang über die Materialverwaltung."
    }
  );

  if (stockError) {
    console.error("Fehler beim Wareneingang:", stockError);

    setMessage(
      `Material konnte nicht hinzugefügt werden: ${stockError.message}`
    );

    return;
  }

  const { data: updatedMaterial, error: reloadError } = await supabase
    .from("materials")
    .select("stock_quantity")
    .eq("id", editingMaterialId)
    .single();

  if (reloadError) {
    console.error(
      "Aktualisierter Lagerbestand konnte nicht geladen werden:",
      reloadError
    );
  } else {
    setStockQuantity(
      String(Number(updatedMaterial?.stock_quantity ?? 0))
    );
  }

  setPurchaseQuantity("");
  setMessage(`✅ ${quantity} wurden dem Lagerbestand hinzugefügt.`);

  await loadMaterials();
};

  const handleCreateMaterial = async (e: React.FormEvent) => {
  e.preventDefault();
  setMessage("");

  if (!name.trim()) {
    setMessage("Bitte Materialname eingeben.");
    return;
  }

  const materialData = {
    name: name.trim(),
    unit: unit.trim() || "Stk",
    category: category.trim() || null,
    stock_quantity: Number(stockQuantity || 0),
    minimum_quantity: Number(minimumQuantity || 0),
    purchase_price: purchasePrice ? Number(purchasePrice) : null,
    supplier: supplier.trim() || null,
    storage_location: storageLocation.trim() || null,
    description: description.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let error;

  if (editingMaterialId !== null) {
    const { stock_quantity, ...updateData } = materialData;

const result = await supabase
  .from("materials")
  .update(updateData)
  .eq("id", editingMaterialId)
  .eq("tenant_id", tenantId);

    error = result.error;
  } else {
    const result = await supabase.from("materials").insert({
      ...materialData,
      tenant_id: tenantId,
      is_active: true,
    });

    error = result.error;
  }

  if (error) {
    console.error("Fehler beim Speichern des Materials:", error);

    setMessage(
      editingMaterialId !== null
        ? "Material konnte nicht aktualisiert werden."
        : "Material konnte nicht gespeichert werden."
    );

    return;
  }

  const wasEditing = editingMaterialId !== null;

  setName("");
  setUnit("Stk");
  setCategory("");
  setStockQuantity("0");
  setMinimumQuantity("0");
  setPurchasePrice("");
  setSupplier("");
  setStorageLocation("");
  setDescription("");
  setEditingMaterialId(null);

  setMessage(
    wasEditing
      ? "Material wurde aktualisiert."
      : "Material wurde gespeichert."
  );

  await loadMaterials();
};

const filteredMaterials =
  categoryFilter === "Alle"
    ? materials
    : materials.filter(
        (material) => material.category === categoryFilter
      );

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
          <h3>
  {editingMaterialId !== null
    ? "Material bearbeiten"
    : "Neues Material anlegen"}
          </h3>

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
  <label>Aktueller Lagerbestand</label>
  <input
    type="number"
    step="0.01"
    value={stockQuantity}
    disabled
    style={{
      backgroundColor: "#f3f4f6",
      color: "#6b7280",
      cursor: "not-allowed",
    }}
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

<hr style={{ margin: "24px 0" }} />

<h3>📦 Wareneingang</h3>

<div className="form-group">
  <label>Menge hinzufügen</label>
  <input
    type="number"
    step="0.01"
    min="0"
    value={purchaseQuantity}
    onChange={(e) => setPurchaseQuantity(e.target.value)}
    placeholder="z. B. 10"
  />
</div>

<button
  type="button"
  className="btn btn-secondary"
  onClick={handleAddMaterialStock}
>
  📦 Material hinzufügen
</button>

<hr style={{ margin: "24px 0" }} />

          <button type="submit" className="btn btn-primary">
  {editingMaterialId !== null
    ? "💾 Änderungen speichern"
    : "➕ Material speichern"}
</button>

{editingMaterialId !== null && (
  <button
    type="button"
    className="btn btn-secondary"
    style={{ marginLeft: 10 }}
    onClick={() => {
      setEditingMaterialId(null);

      setName("");
      setUnit("Stk");
      setCategory("");
      setStockQuantity("0");
      setMinimumQuantity("0");
      setPurchasePrice("");
      setSupplier("");
      setStorageLocation("");
      setDescription("");

      setMessage("");
    }}
  >
    Abbrechen
  </button>
)}

        </form>

        <div className="table-wrapper" style={{ marginTop: 28 }}>

<div className="form-row" style={{ marginBottom: 16 }}>
  <div className="form-group">
    <label>Kategorie</label>
    <select
      value={categoryFilter}
      onChange={(e) => setCategoryFilter(e.target.value)}
    >
      <option value="Alle">Alle</option>

      {[...new Set(
        materials
          .map((m) => m.category)
          .filter((c): c is string => !!c)
      )]
        .sort()
        .map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
    </select>
  </div>
</div>

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
                <th>Aktionen</th>
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
                filteredMaterials.map((material) => {
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

                      <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
  setEditingMaterialId(material.id);

  setName(material.name);
  setCategory(material.category || "");
  setUnit(material.unit);
  setStockQuantity(String(material.stock_quantity));
  setMinimumQuantity(String(material.minimum_quantity));
  setPurchasePrice(
    material.purchase_price !== null
      ? String(material.purchase_price)
      : ""
  );
  setSupplier(material.supplier || "");
  setStorageLocation(material.storage_location || "");
  setDescription(material.description || "");

  setMessage("");
}}
              >
                         ✏️ Bearbeiten
                       </button>
                    </td>
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