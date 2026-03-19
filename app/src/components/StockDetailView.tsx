import { useState, useEffect, useRef, FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { StockVehicle, StockVehicleForm } from "../types";

interface VehiclePhoto {
  file_name: string;
  data_url: string;
}

interface Props {
  vehicle: StockVehicle;
  thumbnail: string | null;
  submitting: boolean;
  onSave: (vehicleName: string, form: StockVehicleForm) => Promise<void>;
  onDelete: (folderPath: string, name: string) => void;
  onBack: () => void;
}

export function StockDetailView({ vehicle, thumbnail, submitting, onSave, onDelete, onBack }: Props) {
  const [name, setName] = useState(vehicle.name);
  const [form, setForm] = useState<StockVehicleForm>({
    url: vehicle.ad_info?.url ?? "",
    status: vehicle.ad_info?.status ?? "",
    date: vehicle.ad_info?.date ?? "",
    precio_compra: vehicle.precio_compra ?? null,
    precio_venta: vehicle.precio_venta ?? null,
    km: vehicle.km ?? null,
    anio: vehicle.anio ?? null,
    estado: vehicle.estado ?? "disponible",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPhotos();
  }, [vehicle.folder_path]);

  async function loadPhotos() {
    setLoadingPhotos(true);
    try {
      const result = await invoke<VehiclePhoto[]>("list_vehicle_photos", { folderPath: vehicle.folder_path });
      setPhotos(result);
    } catch {
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await fileToDataUrl(file);
        const fileName = file.name;
        await invoke("save_vehicle_photo", {
          folderPath: vehicle.folder_path,
          photoData: dataUrl,
          fileName,
        });
      }
      await loadPhotos();
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(fileName: string) {
    if (!window.confirm(`Eliminar foto ${fileName}?`)) return;
    try {
      await invoke("delete_vehicle_photo", { folderPath: vehicle.folder_path, fileName });
      setPhotos((prev) => prev.filter((p) => p.file_name !== fileName));
      if (selectedPhoto === fileName) setSelectedPhoto(null);
    } catch (err) {
      setError(String(err));
    }
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onSave(name, form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const mainPhoto = selectedPhoto
    ? photos.find((p) => p.file_name === selectedPhoto)?.data_url
    : photos[0]?.data_url ?? thumbnail;

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">Stock</p>
          <h2>{vehicle.name}</h2>
          <p className="muted">
            {[vehicle.anio, vehicle.km ? `${vehicle.km.toLocaleString()} km` : null, vehicle.estado].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="button secondary" onClick={onBack}>Volver al stock</button>
          {vehicle.ad_info?.url && (
            <button type="button" className="button secondary" onClick={() => void invoke("open_external", { target: vehicle.ad_info?.url })}>Ver anuncio</button>
          )}
          <button type="button" className="button secondary" onClick={() => void invoke("open_folder", { path: vehicle.folder_path })}>Abrir carpeta</button>
          <button type="button" className="button danger" onClick={() => onDelete(vehicle.folder_path, vehicle.name)}>Eliminar</button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Left: photo viewer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <section className="panel" style={{ overflow: "hidden", padding: 0 }}>
            {mainPhoto ? (
              <img src={mainPhoto} alt={vehicle.name} style={{ width: "100%", display: "block", borderRadius: 24 }} />
            ) : (
              <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Sin fotos</div>
            )}
          </section>

          {/* Thumbnails strip */}
          {photos.length > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
              {photos.map((p) => (
                <img
                  key={p.file_name}
                  src={p.data_url}
                  alt={p.file_name}
                  onClick={() => setSelectedPhoto(p.file_name)}
                  style={{
                    width: 72, height: 54, objectFit: "cover", borderRadius: 8, cursor: "pointer",
                    border: (selectedPhoto === p.file_name || (!selectedPhoto && p === photos[0])) ? "2px solid #1d4ed8" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: form */}
        <section className="panel" style={{ padding: "1.5rem" }}>
          <p className="eyebrow" style={{ marginBottom: "1rem" }}>Datos del vehiculo</p>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label className="field-label" htmlFor="detail-name">Marca y modelo</label>
              <input id="detail-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="field-label" htmlFor="detail-year">Año</label>
                <input id="detail-year" type="number" value={form.anio || ""} onChange={(e) => setForm({ ...form, anio: e.target.value ? parseInt(e.target.value) : null })} placeholder="2020" />
              </div>
              <div>
                <label className="field-label" htmlFor="detail-km">Kilometros</label>
                <input id="detail-km" type="number" value={form.km || ""} onChange={(e) => setForm({ ...form, km: e.target.value ? parseInt(e.target.value) : null })} placeholder="125000" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label className="field-label" htmlFor="detail-precio-compra">Precio compra</label>
                <input id="detail-precio-compra" type="number" step="100" value={form.precio_compra || ""} onChange={(e) => setForm({ ...form, precio_compra: e.target.value ? parseFloat(e.target.value) : null })} placeholder="8500" />
              </div>
              <div>
                <label className="field-label" htmlFor="detail-precio-venta">Precio venta</label>
                <input id="detail-precio-venta" type="number" step="100" value={form.precio_venta || ""} onChange={(e) => setForm({ ...form, precio_venta: e.target.value ? parseFloat(e.target.value) : null })} placeholder="10500" />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="detail-url">Enlace anuncio</label>
              <input id="detail-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.coches.net/..." />
            </div>
            <div>
              <label className="field-label" htmlFor="detail-estado">Estado</label>
              <select id="detail-estado" value={form.estado || "disponible"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
            {error && <p className="error-banner">{error}</p>}
            {success && <p className="success-banner">Guardado correctamente</p>}
            <div className="actions" style={{ marginTop: "0.5rem" }}>
              <button type="submit" className="button primary" disabled={saving || submitting}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Photos section */}
      <section className="panel" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Fotografias</p>
            <p className="muted" style={{ margin: 0 }}>{photos.length} foto{photos.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => void handleFileUpload(e)}
              style={{ display: "none" }}
              id="photo-upload"
            />
            <button
              type="button"
              className="button primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Subiendo..." : "Subir fotos"}
            </button>
          </div>
        </div>

        {loadingPhotos ? (
          <p className="muted">Cargando fotos...</p>
        ) : photos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
            {photos.map((photo) => (
              <div key={photo.file_name} style={{ position: "relative" }}>
                <img
                  src={photo.data_url}
                  alt={photo.file_name}
                  style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12, display: "block", cursor: "pointer" }}
                  onClick={() => setSelectedPhoto(photo.file_name)}
                />
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(photo.file_name)}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", borderRadius: 8, padding: "4px 8px",
                    fontSize: "0.75rem", cursor: "pointer", fontWeight: 700,
                  }}
                >
                  X
                </button>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", textAlign: "center" }}>
                  {photo.file_name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No hay fotos. Pulsa "Subir fotos" para añadir imagenes del vehiculo.</p>
        )}
      </section>
    </>
  );
}
