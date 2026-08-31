// Root page — middleware handles redirect to /dashboard or /login
export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-muted)",
      }}
    >
      <p>Redirigiendo...</p>
    </div>
  );
}
