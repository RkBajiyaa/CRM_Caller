export default function Loading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-6)" }}>
      <div
        style={{
          height: 260,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      />
      <div
        style={{
          height: 400,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      />
    </div>
  );
}
