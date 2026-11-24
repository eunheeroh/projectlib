const state = { all: [], filtered: [] };

const elements = {
  search: document.querySelector("#searchInput"),
  district: document.querySelector("#districtFilter"),
  type: document.querySelector("#typeFilter"),
  age: document.querySelector("#ageFilter"),
  districtChart: document.querySelector("#districtChart"),
  typeDonut: document.querySelector("#typeDonut"),
  typeLegend: document.querySelector("#typeLegend"),
  ageChart: document.querySelector("#ageChart"),
  libraryList: document.querySelector("#libraryList"),
  directoryTable: document.querySelector("#directoryTable")
};

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim()); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(value => value)) rows.push(row);
      row = []; field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }

  const headers = rows.shift();
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

async function loadData() {
  try {
    const response = await fetch("libraries.csv");
    if (!response.ok) throw new Error("CSV 로드 실패");
    state.all = parseCSV(await response.text());
    initFilters();
    applyFilters();
  } catch (error) {
    showToast("데이터 파일을 불러올 수 없습니다.");
  }
}

function uniqueSorted(items) {
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function initFilters() {
  fillSelect(elements.district, uniqueSorted(state.all.map(row => row["구명"])));
  fillSelect(elements.type, uniqueSorted(state.all.map(row => row["관종"])));
  fillSelect(elements.age, uniqueSorted(state.all.map(row => row["연령구분"])));
}

function fillSelect(select, values) {
  const first = select.options[0].outerHTML;
  select.innerHTML = first;
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const query = elements.search.value.trim().toLowerCase();
  state.filtered = state.all.filter(row => {
    const haystack = `${row["도서관명"]} ${row["주소"]}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (!elements.district.value || row["구명"] === elements.district.value)
      && (!elements.type.value || row["관종"] === elements.type.value)
      && (!elements.age.value || row["연령구분"] === elements.age.value);
  });
  render();
}

function countBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key] || "미분류";
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});
}

function percent(part, whole) {
  return whole ? (part / whole * 100).toFixed(1) : "0.0";
}

function render() {
  const rows = state.filtered;
  document.querySelector("#totalCount").textContent = rows.length.toLocaleString();
  document.querySelector("#publicCount").textContent = (countBy(rows, "관종")["공공도서관"] || 0).toLocaleString();
  document.querySelector("#publicShare").textContent = `전체의 ${percent(countBy(rows, "관종")["공공도서관"] || 0, rows.length)}%`;
  document.querySelector("#smallCount").textContent = (countBy(rows, "관종")["작은도서관"] || 0).toLocaleString();
  document.querySelector("#smallShare").textContent = `전체의 ${percent(countBy(rows, "관종")["작은도서관"] || 0, rows.length)}%`;
  document.querySelector("#districtCount").textContent = Object.keys(countBy(rows, "구명")).filter(key => key !== "미분류").length;
  document.querySelector("#districtBadge").textContent = `${rows.length.toLocaleString()}개 기관`;
  document.querySelector("#donutCount").textContent = rows.length.toLocaleString();
  renderDistrictChart(rows);
  renderTypeChart(rows);
  renderAgeChart(rows);
  renderLibraryList(rows);
  renderDirectory(rows);
}

function renderDistrictChart(rows) {
  const counts = countBy(rows, "구명");
  const entries = Object.entries(counts).filter(([key]) => key !== "미분류").sort((a, b) => b[1] - a[1]).slice(0, 12);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  elements.districtChart.innerHTML = entries.map(([district, count]) =>
    `<div class="bar-column" title="${district}: ${count}개">
      <div class="bar" style="height:${count / max * 82}%">
        <span class="bar-value">${count}</span>
      </div>
      <span class="bar-label">${district.replace("구", "")}</span>
    </div>`
  ).join("") || '<div class="empty">검색 결과가 없습니다.</div>';
}

function renderTypeChart(rows) {
  const desired = ["공공도서관", "작은도서관", "전문도서관"];
  const counts = countBy(rows, "관종");
  const main = desired.map(name => [name, counts[name] || 0]);
  const rest = Object.entries(counts).filter(([name]) => !desired.includes(name)).reduce((sum, [, count]) => sum + count, 0);
  main.push(["기타", rest]);
  const colors = ["#4b86b4", "#86b2d2", "#b1c8da", "#dce5ec"];
  let start = 0;
  const segments = main.map(([, count], index) => {
    const end = start + (rows.length ? count / rows.length * 100 : 0);
    const segment = `${colors[index]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  elements.typeDonut.style.background = `conic-gradient(${segments.join(",")})`;
  elements.typeLegend.innerHTML = main.map(([name, count], index) =>
    `<div class="legend-row">
      <span class="legend-dot" style="background:${colors[index]}"></span>
      <span>${name}</span><b>${count}</b>
    </div>`
  ).join("");
}

function renderAgeChart(rows) {
  const counts = countBy(rows, "연령구분");
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...entries.map(([, count]) => count), 1);
  elements.ageChart.innerHTML = entries.map(([age, count]) =>
    `<div class="age-row">
      <span>${age || "미분류"}</span>
      <div class="age-track"><div class="age-fill" style="width:${count / max * 100}%"></div></div>
      <b>${count}</b>
    </div>`
  ).join("") || '<div class="empty">검색 결과가 없습니다.</div>';
}

function renderLibraryList(rows) {
  elements.libraryList.innerHTML = rows.slice(0, 4).map(row =>
    `<div class="library-row">
      <div class="library-icon">▤</div>
      <div class="library-info">
        <strong>${escapeHTML(row["도서관명"])}</strong>
        <span>${escapeHTML(row["구명"])} · ${escapeHTML(row["주소"])}</span>
      </div>
      <span class="library-type">${escapeHTML(row["관종"] || "기타")}</span>
    </div>`
  ).join("") || '<div class="empty">검색 결과가 없습니다.</div>';
}

function renderDirectory(rows) {
  document.querySelector("#directoryCount").textContent = `${rows.length.toLocaleString()}개`;
  elements.directoryTable.innerHTML = rows.map(row =>
    `<tr>
      <td>${escapeHTML(row["도서관명"])}</td>
      <td>${escapeHTML(row["구명"])}</td>
      <td>${escapeHTML(row["관종"])}</td>
      <td>${escapeHTML(row["연령구분"] || "-")}</td>
      <td>${escapeHTML(row["주소"])}</td>
      <td>${escapeHTML(row["운영시간"] || "-")}</td>
    </tr>`
  ).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char]));
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

[elements.search, elements.district, elements.type, elements.age].forEach(control => {
  control.addEventListener(control.tagName === "INPUT" ? "input" : "change", applyFilters);
});

document.querySelector("#resetFilters").addEventListener("click", () => {
  elements.search.value = "";
  elements.district.value = "";
  elements.type.value = "";
  elements.age.value = "";
  applyFilters();
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    document.querySelector(button.dataset.view === "dashboard" ? "#dashboardView" : "#directoryView").classList.add("active");
  });
});

document.querySelector("#viewAllButton").addEventListener("click", () => {
  document.querySelector('[data-view="directory"]').click();
});

document.querySelector("#refreshButton").addEventListener("click", () => {
  loadData();
  showToast("데이터를 새로고침했습니다.");
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const headers = ["도서관명", "구명", "관종", "연령구분", "주소", "운영시간"];
  const csv = [headers.join(","), ...state.filtered.map(row =>
    headers.map(header => `"${String(row[header] || "").replace(/"/g, '""')}"`).join(",")
  )].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "서울시_도서관_필터결과.csv";
  link.click();
  URL.revokeObjectURL(url);
});

loadData();
