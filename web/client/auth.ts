import { api, setToken } from "./api.js";

function wire(formId: string, endpoint: string): void {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return;
  const errorBox = document.getElementById("formError") as HTMLElement;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    const email = (document.getElementById("email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const fullName = (document.getElementById("fullName") as HTMLInputElement | null)?.value.trim();
    try {
      const { token } = await api<{ token: string }>(endpoint, { method: "POST", body: { email, password, ...(fullName ? { fullName } : {}) } });
      setToken(token);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err instanceof Error ? err.message : "Something went wrong";
    }
  });
}

wire("loginForm", "/auth/login");
wire("registerForm", "/auth/register");
