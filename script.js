const defaultProblems = [
    { id: "def-1", topic: "Arrays", title: "Maximum and Minimum Element", companies: ["Amazon", "Google", "Microsoft"], link: "https://www.geeksforgeeks.org/maximum-and-minimum-in-an-array/", source: "Default", difficulty: "Easy" },
    { id: "def-2", topic: "Arrays", title: "Reverse the Array", companies: ["Infosys"], link: "https://www.geeksforgeeks.org/write-a-program-to-reverse-an-array-or-string/", source: "Default", difficulty: "Easy" },
    { id: "def-3", topic: "Arrays", title: "Maximum Subarray (Kadane's)", companies: ["Facebook", "Microsoft"], link: "https://leetcode.com/problems/maximum-subarray/", source: "Default", difficulty: "Medium" }
];

let dsaProblems = JSON.parse(localStorage.getItem('dsaTrackerQuestions')) || defaultProblems;
let completionData = JSON.parse(localStorage.getItem('dsaTrackerCompletionData')) || {};
let dailyTargets = JSON.parse(localStorage.getItem('dsaTrackerDailyTargets')) || {};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDateForModal = null, selectedIdsForModal = [], isTodayFilterActive = false, activeImportType = 'file';

function showToast(msg) {
    const toast = document.getElementById('toast'), tm = document.getElementById('toast-message');
    if (!toast || !tm) return;
    tm.innerText = msg; toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

function switchTab(tab) {
    ['tracker', 'planner', 'analytics'].forEach(v => {
        document.getElementById(`view-${v}`)?.classList.toggle('hidden', v !== tab);
        document.getElementById(`tab-${v}`)?.classList.toggle('tab-active', v === tab);
        document.getElementById(`tab-${v}`)?.classList.toggle('text-slate-400', v !== tab);
    });
    if (tab === 'analytics') renderAnalytics();
    if (tab === 'planner') renderCalendar();
    if (tab === 'tracker') { checkTodayTarget(); renderTable(); }
}

// --- GITHUB SYNC ---
function openSettingsModal() {
    document.getElementById('gh-token').value = localStorage.getItem('ghToken') || '';
    document.getElementById('gh-owner').value = localStorage.getItem('ghOwner') || '';
    document.getElementById('gh-repo').value = localStorage.getItem('ghRepo') || '';
    document.getElementById('gh-path').value = localStorage.getItem('ghPath') || 'dsa_sheet.csv';
    document.getElementById('gh-targets-path').value = localStorage.getItem('ghTargetsPath') || 'dailyTargets.json';
    document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }
function saveGitHubSettings() {
    localStorage.setItem('ghToken', document.getElementById('gh-token').value.trim());
    localStorage.setItem('ghOwner', document.getElementById('gh-owner').value.trim());
    localStorage.setItem('ghRepo', document.getElementById('gh-repo').value.trim());
    localStorage.setItem('ghPath', document.getElementById('gh-path').value.trim());
    localStorage.setItem('ghTargetsPath', document.getElementById('gh-targets-path').value.trim());
    showToast("Settings Saved Locally");
}
async function fetchFromGitHub() {
    const token = localStorage.getItem('ghToken'), owner = localStorage.getItem('ghOwner'), repo = localStorage.getItem('ghRepo');
    const pathCsv = localStorage.getItem('ghPath') || 'dsa_sheet.csv';
    const pathJson = localStorage.getItem('ghTargetsPath') || 'dailyTargets.json';

    if (!token || !owner || !repo) return showToast("Configure settings first!");
    const icon = document.getElementById('settings-icon');
    icon.classList.add('animate-spin-fast');

    try {
        const headers = { 'Authorization': `token ${token}` };

        // 1. Fetch CSV (Questions)
        const csvRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathCsv}`, { headers });
        if (csvRes.ok) {
            const csvData = await csvRes.json();
            const csvContent = atob(csvData.content);
            const workbook = XLSX.read(csvContent, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const newProblems = [];
            const newCompletion = {};

            rawData.forEach((row, i) => {
                const topic = row.Category || row.Topic || "General";
                const title = row.Question || row.Title || `Problem-${i}`;
                const id = row.ID || `import-${Date.now()}-${i}`;
                const link = row["Problem Link"] || row.Link || "#";
                const comps = (row.Companies || "").toString().split(' ').filter(Boolean);
                const diff = row.Difficulty || "Medium";
                const status = row.Status || "Pending";

                newProblems.push({ id, topic, title, link, source: "GitHub", companies: comps, difficulty: diff });
                if (status === 'Done') newCompletion[id] = { date: new Date().toISOString() };
            });

            // Merge Problems
            const existingMap = new Map(dsaProblems.map(p => [p.id, p]));
            newProblems.forEach(p => existingMap.set(p.id, p));
            dsaProblems = Array.from(existingMap.values());

            // Merge Completion (CSV is baseline)
            completionData = { ...completionData, ...newCompletion };
        }

        // 2. Fetch JSON (Targets & Metadata)
        const jsonRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathJson}`, { headers });
        if (jsonRes.ok) {
            const jsonData = await jsonRes.json();
            try {
                const content = JSON.parse(atob(jsonData.content));
                dailyTargets = { ...dailyTargets, ...(content.dailyTargets || {}) };
                // Restore precise completion timestamps if available
                if (content.completionData) {
                    completionData = { ...completionData, ...content.completionData };
                }
            } catch (e) { console.error("JSON Targets parse error", e); }
        }

        updateStats(); renderTable(); renderCalendar();
        showToast("Sync Complete (CSV + JSON)");

    } catch (err) { showToast("Error: " + err.message); } finally { icon.classList.remove('animate-spin-fast'); }
}

async function pushToGitHub() {
    const token = localStorage.getItem('ghToken'), owner = localStorage.getItem('ghOwner'), repo = localStorage.getItem('ghRepo');
    const pathCsv = localStorage.getItem('ghPath') || 'dsa_sheet.csv';
    const pathJson = localStorage.getItem('ghTargetsPath') || 'dailyTargets.json';

    if (!token || !owner || !repo) return showToast("Configure settings first!");
    const icon = document.getElementById('settings-icon');
    icon.classList.add('animate-spin-fast');

    const headers = { 'Authorization': `token ${token}` };

    try {
        // 1. Push CSV (Questions + Status)
        const flatData = dsaProblems.map(p => ({
            ID: p.id,
            Category: p.topic,
            Question: p.title,
            "Problem Link": p.link,
            Companies: p.companies.join(' '),
            Difficulty: p.difficulty,
            Status: completionData[p.id] ? 'Done' : 'Pending'
        }));
        const ws = XLSX.utils.json_to_sheet(flatData);
        const csvOutput = XLSX.utils.sheet_to_csv(ws);
        const csvBase64 = btoa(csvOutput);

        let shaCsv = null;
        const getCsv = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathCsv}`, { headers });
        if (getCsv.ok) shaCsv = (await getCsv.json()).sha;

        const resCsv = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathCsv}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ message: "Update DSA CSV", content: csvBase64, sha: shaCsv })
        });
        if (!resCsv.ok) throw new Error("CSV Push failed");

        // 2. Push JSON (Targets + Metadata)
        const jsonContent = { dailyTargets, completionData };
        const jsonBase64 = btoa(JSON.stringify(jsonContent, null, 2));

        let shaJson = null;
        const getJson = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathJson}`, { headers });
        if (getJson.ok) shaJson = (await getJson.json()).sha;

        const resJson = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${pathJson}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ message: "Update Daily Targets", content: jsonBase64, sha: shaJson })
        });
        if (!resJson.ok) throw new Error("Targets Push failed");

        showToast("Backup Successful (Files Split)!");
    } catch (err) { showToast("Error: " + err.message); } finally { icon.classList.remove('animate-spin-fast'); }
}

// --- IMPORT LOGIC ---
function openImportModal() {
    document.getElementById('import-modal')?.classList.remove('hidden');
    const list = document.getElementById('topic-suggestions');
    const topics = [...new Set(dsaProblems.map(p => p.topic))].sort();
    list.innerHTML = topics.map(t => `<option value="${t}">`).join('');
}
function closeImportModal() { document.getElementById('import-modal')?.classList.add('hidden'); }

function switchImportType(type) {
    activeImportType = type;
    ['file', 'json', 'manual'].forEach(t => {
        const sec = document.getElementById(`section-import-${t}`);
        const btn = document.getElementById(`btn-import-${t}`);
        if (sec) sec.classList.toggle('hidden', t !== type);
        if (btn) btn.className = t === type ? "pb-2 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 uppercase transition-all" : "pb-2 text-xs font-bold border-b-2 border-transparent text-slate-400 uppercase hover:text-slate-600 transition-all";
    });
}

function executeImport() {
    const source = document.getElementById('import-source')?.value.trim() || "Imported";
    if (activeImportType === 'file') {
        const file = document.getElementById('import-file-input')?.files[0];
        if (!file) return showToast("Select CSV.");
        const reader = new FileReader();
        reader.onload = (e) => handleDataArray(XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]), source);
        reader.readAsArrayBuffer(file);
    } else if (activeImportType === 'json') {
        try {
            let clean = document.getElementById('import-json-input').value.trim();
            if (clean.endsWith(';')) clean = clean.slice(0, -1);
            handleDataArray(JSON.parse(clean), source);
        } catch (e) { showToast("JSON Syntax Error"); }
    } else {
        // Manual Entry
        const title = document.getElementById('manual-title').value.trim();
        const category = document.getElementById('manual-category').value.trim();
        const link = document.getElementById('manual-link').value.trim();
        const difficulty = document.getElementById('manual-difficulty').value;
        const companies = document.getElementById('manual-companies').value;
        if (!title || !category) return showToast("Title & Topic required");
        handleDataArray([{ ID: Date.now(), Category: category, Question: title, "Problem Link": link, Companies: companies, Difficulty: difficulty }], source);
    }
}

function handleDataArray(data, source) {
    const existingKeys = new Set(dsaProblems.map(p => `${p.topic.toLowerCase()}|${p.title.toLowerCase()}`));
    let added = 0;
    data.forEach((row, i) => {
        const keys = Object.keys(row);
        const find = (names) => {
            const k = keys.find(key => names.includes(key.trim().toLowerCase()));
            return k ? String(row[k]).trim() : "";
        };
        const topic = find(['category', 'topic']) || "General", title = find(['question', 'problem', 'title']) || `P-${i + 1}`;
        if (existingKeys.has(`${topic.toLowerCase()}|${title.toLowerCase()}`)) return;
        const id = `import-${Date.now()}-${i}`;
        dsaProblems.push({ id, topic, title, link: find(['problem link', 'link']) || "#", companies: (find(['companies', 'company'])).split(/[,\s+]+/).map(c => c.trim()).filter(Boolean), difficulty: find(['difficulty', 'level']) || "Medium", source });
        if (find(['status']).toLowerCase().includes('done')) completionData[id] = { date: new Date().toISOString() };
        existingKeys.add(`${topic.toLowerCase()}|${title.toLowerCase()}`);
        added++;
    });
    if (added) { updateStats(); renderTable(); showToast(`${added} added.`); closeImportModal(); } else showToast("Duplicate entry skipped.");
}

// --- TRACKER LOGIC ---
function toggleTodayFilter() { isTodayFilterActive = !isTodayFilterActive; renderTable(); }
function checkTodayTarget() {
    const todayStr = new Date().toISOString().split('T')[0];
    const has = dailyTargets[todayStr]?.questionIds.length > 0;
    document.getElementById('today-filter-btn')?.classList.toggle('hidden', !has);
    if (!has) isTodayFilterActive = false;
}
function updateStats() {
    const total = dsaProblems.length, completed = Object.keys(completionData).filter(id => dsaProblems.some(p => p.id === id)).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-text').innerText = pct + '%';
    document.getElementById('stats-detail').innerText = `${completed} / ${total} Solved`;
    localStorage.setItem('dsaTrackerCompletionData', JSON.stringify(completionData));
    localStorage.setItem('dsaTrackerQuestions', JSON.stringify(dsaProblems));
    localStorage.setItem('dsaTrackerDailyTargets', JSON.stringify(dailyTargets));
}
function toggleComplete(id) {
    if (completionData[id]) delete completionData[id]; else completionData[id] = { date: new Date().toISOString() };
    updateStats(); renderTable();
}
function renderTable() {
    const search = document.getElementById('search-input')?.value.toLowerCase() || "";
    const topic = document.getElementById('topic-filter')?.value || "all";
    const todayStr = new Date().toISOString().split('T')[0];
    const targetIds = isTodayFilterActive ? dailyTargets[todayStr]?.questionIds : null;
    const filtered = dsaProblems.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search) || p.companies.some(c => c.toLowerCase().includes(search)) || p.difficulty.toLowerCase().includes(search);
        const matchTopic = topic === 'all' || p.topic === topic;
        const matchToday = !isTodayFilterActive || (targetIds && targetIds.includes(p.id));
        return matchSearch && matchTopic && matchToday;
    });
    document.getElementById('no-results')?.classList.toggle('hidden', filtered.length > 0);
    document.getElementById('table-body').innerHTML = filtered.map(p => {
        const isDone = !!completionData[p.id];
        const d = (p.difficulty || "Medium").toLowerCase();
        const dColor = d === 'easy' ? 'text-emerald-500 bg-emerald-50' : (d === 'hard' ? 'text-rose-500 bg-rose-50' : 'text-amber-500 bg-amber-50');
        return `<tr class="transition-all ${isDone ? 'row-done' : ''}"><td class="px-6 py-4 text-center"><button onclick="toggleComplete('${p.id}')" class="focus:outline-none"><div class="w-5 h-5 rounded border-2 ${isDone ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-300'} flex items-center justify-center transition-all">${isDone ? '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</div></button></td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-white border border-slate-200 text-slate-500 uppercase">${p.topic}</span></td><td class="px-6 py-4"><div class="flex flex-col"><a href="${p.link}" target="_blank" class="text-sm font-bold ${isDone ? 'text-emerald-800' : 'text-slate-800'} hover:text-indigo-600 transition-colors">${p.title}</a>${isDone ? `<span class="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">Completed ${new Date(completionData[p.id].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>` : ''}</div></td><td class="px-6 py-4"><div class="flex flex-wrap gap-1 items-center"><span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${dColor}">${p.difficulty}</span>${p.source ? `<span class="px-1.5 py-0.5 rounded bg-indigo-50 text-[9px] font-bold text-indigo-500 border border-indigo-100 uppercase italic">${p.source}</span>` : ''}${p.companies.map(c => `<span class="px-1.5 py-0.5 rounded bg-white/60 text-[9px] font-bold text-slate-400 border border-slate-100 uppercase">${c}</span>`).join('')}</div></td></tr>`;
    }).join('');
}

// --- PLANNER ---
function changeMonth(dir) { currentMonth += dir; if (currentMonth < 0) { currentMonth = 11; currentYear--; } else if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }
function renderCalendar() {
    const first = new Date(currentYear, currentMonth, 1).getDay(), days = new Date(currentYear, currentMonth + 1, 0).getDate();
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendar-title').innerText = `${names[currentMonth]} ${currentYear}`;
    let g = ''; for (let i = 0; i < first; i++) g += `<div class="bg-slate-50/50"></div>`;
    const today = new Date().toISOString().split('T')[0];
    for (let d = 1; d <= days; d++) {
        const iso = new Date(currentYear, currentMonth, d).toISOString().split('T')[0], tar = dailyTargets[iso], isT = iso === today;
        g += `<div onclick="openTargetModal('${iso}')" class="calendar-day relative p-3 border-r border-b border-slate-100 cursor-pointer ${isT ? 'day-today' : ''} ${tar?.questionIds.length > 0 ? 'has-target' : ''}"><span class="text-xs font-extrabold ${isT ? 'text-indigo-600' : 'text-slate-400'}">${d}</span>${tar ? `<div class="mt-1 text-[9px] font-bold text-slate-700 truncate">${tar.headline}</div>` : ''}${tar?.questionIds.length > 0 ? `<div class="text-[8px] text-indigo-500 font-extrabold uppercase mt-1">${tar.questionIds.length} Target(s)</div>` : ''}</div>`;
    }
    document.getElementById('calendar-grid').innerHTML = g;
}
function openTargetModal(date) { selectedDateForModal = date; const d = dailyTargets[date] || { headline: '', questionIds: [] }; selectedIdsForModal = [...d.questionIds]; document.getElementById('modal-date-title').innerText = `Planner: ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`; document.getElementById('target-headline').value = d.headline; document.getElementById('target-modal')?.classList.remove('hidden'); renderSelectedTargets(); renderSearchResults(''); }
function closeTargetModal() { document.getElementById('target-modal')?.classList.add('hidden'); }
function renderSearchResults(q) { if (q.length < 2) { document.getElementById('search-results').innerHTML = '<p class="text-[10px] text-slate-400 p-2 italic text-center">Search question...</p>'; return; } const fl = dsaProblems.filter(p => p.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8); document.getElementById('search-results').innerHTML = fl.map(p => `<div onclick="addIdToModal('${p.id}')" class="p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-slate-100 flex justify-between items-center transition-all"><span class="text-[11px] font-bold text-slate-700">${p.title}</span><span class="text-[9px] uppercase font-extrabold text-slate-300 bg-slate-100 px-1 rounded">${p.topic}</span></div>`).join('') || '<p class="text-xs text-slate-400 p-2">None.</p>'; }
function addIdToModal(id) { if (!selectedIdsForModal.includes(id)) { selectedIdsForModal.push(id); renderSelectedTargets(); } }
function removeIdFromModal(id) { selectedIdsForModal = selectedIdsForModal.filter(i => i !== id); renderSelectedTargets(); }
function renderSelectedTargets() { document.getElementById('selected-targets').innerHTML = selectedIdsForModal.map(id => { const p = dsaProblems.find(item => item.id === id); if (!p) return ''; return `<div class="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-bold text-indigo-600 flex items-center gap-1">${p.title} <button onclick="removeIdFromModal('${id}')" class="hover:text-rose-500"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg></button></div>`; }).join('') || '<p class="text-[10px] text-slate-400 italic">No targets.</p>'; }
function saveDailyTargets() { const head = document.getElementById('target-headline')?.value.trim(); if (selectedIdsForModal.length === 0 && !head) delete dailyTargets[selectedDateForModal]; else dailyTargets[selectedDateForModal] = { headline: head || "Session", questionIds: selectedIdsForModal }; updateStats(); renderCalendar(); closeTargetModal(); showToast("Plan saved."); checkTodayTarget(); }

function renderAnalytics() {
    const now = new Date(), weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let week = 0, month = 0, year = 0; const tStats = {}, history = [];
    Object.entries(completionData).forEach(([id, meta]) => {
        const problem = dsaProblems.find(p => p.id === id); if (!problem) return;
        const d = new Date(meta.date); if (d >= weekAgo) week++; if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month++; if (d.getFullYear() === now.getFullYear()) year++;
        tStats[problem.topic] = (tStats[problem.topic] || 0) + 1; history.push({ ...problem, date: d });
    });
    document.getElementById('stat-week').innerText = week; document.getElementById('stat-month').innerText = month; document.getElementById('stat-year').innerText = year;
    const sorted = Object.entries(tStats).sort((a, b) => b[1] - a[1]), max = Math.max(...Object.values(tStats), 1);
    document.getElementById('topic-chart').innerHTML = sorted.map(([n, c]) => `<div><div class="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-1"><span>${n}</span><span>${c} Solved</span></div><div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div class="bg-indigo-400 h-full" style="width: ${(c / max) * 100}%"></div></div></div>`).join('') || '<p class="text-xs text-slate-400">No activity.</p>';
    history.sort((a, b) => b.date - a.date); document.getElementById('history-list').innerHTML = history.slice(0, 5).map(h => `<div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"><span class="text-xs font-bold text-slate-700">${h.title}</span><span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">${h.date.toLocaleDateString()}</span></div>`).join('') || '<p class="text-xs text-slate-400">Empty history.</p>';
}

function exportToExcel() {
    const data = dsaProblems.map(p => ({ ID: p.id, Category: p.topic, Question: p.title, "Problem Link": p.link, Companies: p.companies.join(' '), Difficulty: p.difficulty, Status: completionData[p.id] ? 'Done' : 'Pending' }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DSA_Tracker"); XLSX.writeFile(wb, `DSA_Tracker_${new Date().toISOString().split('T')[0]}.xlsx`); showToast("Exported.");
}
function clearAllData() { if (confirm("Reset everything?")) { localStorage.clear(); location.reload(); } }
function updateTopicFilter() { const topics = [...new Set(dsaProblems.map(p => p.topic))].sort(); document.getElementById('topic-filter').innerHTML = '<option value="all">All Topics</option>' + topics.map(t => `<option value="${t}">${t}</option>`).join(''); }

document.getElementById('search-input')?.addEventListener('input', renderTable);
document.getElementById('topic-filter')?.addEventListener('change', renderTable);
document.getElementById('target-problem-search')?.addEventListener('input', (e) => renderSearchResults(e.target.value));
document.getElementById('import-file-input')?.addEventListener('change', (e) => { document.getElementById('file-label').innerText = e.target.files[0] ? e.target.files[0].name : "Upload CSV"; });

window.onload = () => { updateTopicFilter(); updateStats(); renderTable(); checkTodayTarget(); renderCalendar(); };