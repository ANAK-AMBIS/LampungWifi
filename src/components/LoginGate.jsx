export function LoginGate({ user, signIn, signOut }) {
  if (user) {
    return (
      <div className="login-card login-card--signed-in">
        {user.picture ? <img src={user.picture} alt="" /> : null}
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={signOut}
        >
          Keluar
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <div>
        <strong>Login Google diperlukan</strong>
        <span>Masuk dulu untuk kirim tempat atau rating WiFi.</span>
      </div>
      <button
        type="button"
        className="button button--primary button--small"
        onClick={signIn}
      >
        Login Google
      </button>
    </div>
  );
}
