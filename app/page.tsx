export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1>Conbun CRM</h1>
      <p>
        Project scaffold is up. No customer records, authentication, or CRM
        screens exist yet -- see <code>CRM_ARCHITECTURE.md</code> for the
        architecture and phased implementation plan.
      </p>
      <p>
        Backend health check: <code>GET /api/health</code>
      </p>
    </main>
  );
}
