export function StableDataTable(rows) {
  const body = rows.map(({ id, status }) => `<tr><td>${id}</td><td class="status">${status}</td></tr>`).join("");
  return `<table><thead><tr><th>Record</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}
