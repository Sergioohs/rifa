const els = (id) => document.getElementById(id);

let token = localStorage.getItem("rifa_token") || "";
let currentRaffleId = null;

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro");
  return data;
}

function showLogin(show) {
  els("loginCard").style.display = show ? "" : "none";
  els("raffleCard").style.display = show ? "none" : "";
}

function showTickets(show) {
  els("ticketsCard").style.display = show ? "" : "none";
  els("raffleCard").style.display = show ? "none" : "";
}

function setMsg(id, msg, ok=false) {
  const el = els(id);
  el.innerHTML = msg ? `<span class="badge ${ok ? "ok" : "no"}">${msg}</span>` : "";
}

async function doLogin() {
  setMsg("loginMsg", "");
  const email = els("email").value.trim();
  const password = els("password").value;
  try {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    token = r.token;
    localStorage.setItem("rifa_token", token);
    showLogin(false);
    await loadRaffles();
  } catch (e) {
    setMsg("loginMsg", e.message, false);
  }
}

async function loadRaffles() {
  const box = els("raffles");
  box.innerHTML = `<div class="muted">Carregando...</div>`;
  try {
    const raffles = await api("/api/raffles");
    if (!raffles.length) {
      box.innerHTML = `<div class="muted">Nenhuma rifa ainda.</div>`;
      return;
    }
    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Rifa</th>
            <th>Valor</th>
            <th>Números</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${raffles.map(r => `
            <tr>
              <td>${r.id}</td>
              <td>
                <div><b>${escapeHtml(r.title)}</b></div>
                <div class="muted small">Organizador: ${escapeHtml(r.organizer_name||"-")} • Responsável: ${escapeHtml(r.responsible_name||"-")}</div>
              </td>
              <td>R$ ${r.ticket_price}</td>
              <td>${r.total_tickets} (até ${r.max_number})</td>
              <td><button class="btn" data-open="${r.id}">Abrir</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    box.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => openRaffle(Number(btn.dataset.open)));
    });
  } catch (e) {
    if (String(e.message).includes("Token")) {
      token = "";
      localStorage.removeItem("rifa_token");
      showLogin(true);
      return;
    }
    box.innerHTML = `<span class="badge no">${e.message}</span>`;
  }
}

async function createRaffle() {
  const title = els("newTitle").value.trim();
  const organizer_name = els("organizer").value.trim();
  const responsible_name = els("responsible").value.trim();
  const ticket_price = els("price").value.trim();
  const draw_date = els("drawDate").value || null;

  if (!title) return alert("Informe o nome da rifa.");
  try {
    await api("/api/raffles", {
      method: "POST",
      body: JSON.stringify({ title, organizer_name, responsible_name, ticket_price, draw_date })
    });
    els("newTitle").value = "";
    await loadRaffles();
  } catch (e) {
    alert(e.message);
  }
}

async function openRaffle(id) {
  currentRaffleId = id;
  showTickets(true);
  els("ticketsTitle").textContent = `Números - Rifa #${id}`;
  els("winner").innerHTML = "";
  els("tickets").innerHTML = `<div class="muted">Carregando...</div>`;
  els("csv").href = `/api/raffles/${id}/export.csv`;
  els("pdf").href = `/api/raffles/${id}/export.pdf`;
  await loadTickets();
}

async function loadTickets() {
  const q = els("q").value.trim();
  const paid = els("paidFilter").value;
  const reserved = els("resFilter").value;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (paid !== "") params.set("paid", paid);
  if (reserved !== "") params.set("reserved", reserved);

  const box = els("tickets");
  box.innerHTML = `<div class="muted">Carregando...</div>`;
  try {
    const rows = await api(`/api/raffles/${currentRaffleId}/tickets?${params.toString()}`);
    if (!rows.length) {
      box.innerHTML = `<div class="muted">Nada encontrado.</div>`;
      return;
    }

    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Nome</th>
            <th>Telefone</th>
            <th>Pago</th>
            <th>Reservado</th>
            <th>Obs</th>
            <th>Salvar</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(t => `
            <tr>
              <td><b>${t.number_int}</b></td>
              <td><input data-k="buyer_name" data-id="${t.id}" value="${escapeAttr(t.buyer_name||"")}" placeholder="Nome" /></td>
              <td><input data-k="buyer_phone" data-id="${t.id}" value="${escapeAttr(t.buyer_phone||"")}" placeholder="Telefone" /></td>
              <td>
                <select data-k="paid" data-id="${t.id}">
                  <option value="0" ${t.paid ? "" : "selected"}>NÃO</option>
                  <option value="1" ${t.paid ? "selected" : ""}>SIM</option>
                </select>
              </td>
              <td>
                <select data-k="reserved" data-id="${t.id}">
                  <option value="0" ${t.reserved ? "" : "selected"}>NÃO</option>
                  <option value="1" ${t.reserved ? "selected" : ""}>SIM</option>
                </select>
              </td>
              <td><input data-k="note" data-id="${t.id}" value="${escapeAttr(t.note||"")}" placeholder="Obs" /></td>
              <td><button class="btn primary" data-save="${t.id}">Salvar</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    box.querySelectorAll("[data-save]").forEach(b => {
      b.addEventListener("click", async () => {
        const id = Number(b.dataset.save);
        const inputs = box.querySelectorAll(`[data-id="${id}"]`);
        const payload = {};
        inputs.forEach(el => {
          const k = el.dataset.k;
          let v = el.value;
          if (k === "paid" || k === "reserved") v = Number(v);
          payload[k] = v;
        });
        try {
          await api(`/api/tickets/${id}`, { method:"PATCH", body: JSON.stringify(payload) });
          b.textContent = "Salvo!";
          setTimeout(()=> b.textContent="Salvar", 900);
        } catch (e) {
          alert(e.message);
        }
      });
    });

  } catch (e) {
    box.innerHTML = `<span class="badge no">${e.message}</span>`;
  }
}

async function generateTickets() {
  const max_number = Number(els("maxNumber").value);
  if (!max_number) return alert("Informe o N (ex: 1500).");
  if (!confirm(`Gerar números de 1 até ${max_number}?`)) return;
  try {
    await api(`/api/raffles/${currentRaffleId}/generate-tickets`, {
      method: "POST",
      body: JSON.stringify({ max_number })
    });
    await loadTickets();
  } catch (e) {
    alert(e.message);
  }
}

async function draw() {
  const only_paid = els("onlyPaid").value === "1";
  els("winner").innerHTML = "";
  try {
    const r = await api(`/api/raffles/${currentRaffleId}/draw`, {
      method:"POST",
      body: JSON.stringify({ only_paid })
    });
    const w = r.winner;
    els("winner").innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><b>🎉 Vencedor:</b> Nº ${w.number_int}</div>
        <div class="badge ok">${only_paid ? "Somente pagos" : "Todos"}</div>
      </div>
      <div class="small" style="margin-top:8px">
        <div><b>Nome:</b> ${escapeHtml(w.buyer_name || "-")}</div>
        <div><b>Telefone:</b> ${escapeHtml(w.buyer_phone || "-")}</div>
      </div>
    `;
  } catch (e) {
    els("winner").innerHTML = `<span class="badge no">${e.message}</span>`;
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g, "&quot;"); }

els("loginBtn").addEventListener("click", doLogin);
els("password").addEventListener("keyup", (e)=>{ if(e.key==="Enter") doLogin(); });
els("reload").addEventListener("click", loadRaffles);
els("createRaffle").addEventListener("click", createRaffle);
els("logout").addEventListener("click", ()=>{
  token = "";
  localStorage.removeItem("rifa_token");
  showLogin(true);
});
els("back").addEventListener("click", ()=>{
  currentRaffleId = null;
  showTickets(false);
  loadRaffles();
});
els("search").addEventListener("click", loadTickets);
els("gen").addEventListener("click", generateTickets);
els("draw").addEventListener("click", draw);

(async function init(){
  if (!token) {
    showLogin(true);
    return;
  }
  showLogin(false);
  await loadRaffles();
})();
