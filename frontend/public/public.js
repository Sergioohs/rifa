async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro");
  return data;
}

const raffleIdEl = document.getElementById("raffleId");
const ticketEl = document.getElementById("ticketNum");
const btn = document.getElementById("btnFind");
const result = document.getElementById("result");
const title = document.getElementById("title");
const meta = document.getElementById("meta");

async function loadRaffleIfHasId() {
  const id = Number(raffleIdEl.value);
  if (!id) return;
  try {
    const r = await api(`/api/public/raffles/${id}`);
    title.textContent = r.title;
    meta.textContent = `Organizador: ${r.organizer_name || "-"} • Responsável: ${r.responsible_name || "-"} • Valor: R$ ${r.ticket_price} • Sorteio: ${r.draw_date || "-"}`;
  } catch (e) {
    title.textContent = "Rifa";
    meta.textContent = "Informe o ID da rifa para carregar os dados.";
  }
}

raffleIdEl.addEventListener("change", loadRaffleIfHasId);
raffleIdEl.addEventListener("keyup", (e) => { if (e.key === "Enter") loadRaffleIfHasId(); });

btn.addEventListener("click", async () => {
  const id = Number(raffleIdEl.value);
  const num = Number(ticketEl.value);
  result.innerHTML = "";
  if (!id || !num) {
    result.innerHTML = `<span class="badge no">Preencha ID da rifa e número</span>`;
    return;
  }
  await loadRaffleIfHasId();

  try {
    const t = await api(`/api/public/raffles/${id}/tickets/${num}`);
    result.innerHTML = `
      <div class="row" style="align-items:center;justify-content:space-between">
        <div><b>Número:</b> ${t.number_int}</div>
        <div class="badge ${t.paid ? "ok" : "no"}">${t.paid ? "PAGO" : "NÃO PAGO"}</div>
      </div>
      <div style="margin-top:8px" class="small">
        <div><b>Nome:</b> ${t.buyer_name || "-"}</div>
        <div><b>Telefone:</b> ${t.buyer_phone || "-"}</div>
        <div><b>Reservado:</b> ${t.reserved ? "SIM" : "NÃO"}</div>
        <div><b>Obs:</b> ${t.note || "-"}</div>
      </div>
    `;
  } catch (e) {
    result.innerHTML = `<span class="badge no">${e.message}</span>`;
  }
});
