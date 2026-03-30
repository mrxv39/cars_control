export default function Spinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <div className="loading-screen">
      <div className={`spinner ${size === "lg" ? "lg" : size === "sm" ? "sm" : ""}`} />
      {label && <span>{label}</span>}
    </div>
  );
}
