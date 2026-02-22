function Login() {
  return (
    <div className="login">
      <h1>Login</h1>
      <form>
        <label htmlFor="username">Username:</label>
        <input type="text" id="username" name="username" required />
        
        <label htmlFor="password">Password:</label>
        <input type="password" id="password" name="password" required />
        
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;