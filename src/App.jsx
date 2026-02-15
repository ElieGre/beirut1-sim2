import { useState, useCallback, useMemo, useRef } from "react";

const TOTAL_SEATS = 8;

const CONFESSIONS = [
  "Armenian Orthodox",
  "Armenian Catholic",
  "Maronite",
  "Greek Orthodox",
  "Greek Catholic",
  "Minorities",
];

const CONFESSION_SEAT_COUNT = {
  "Armenian Orthodox": 3,
  "Armenian Catholic": 1,
  "Maronite": 1,
  "Greek Orthodox": 1,
  "Greek Catholic": 1,
  "Minorities": 1,
};

const LIST_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#65a30d",
];

const KNOWN_CANDIDATES = [
  { name: "Nadim Gemayel",       prefVotes: 4425, confession: "Maronite" },
  { name: "Guy Manoukian",       prefVotes: 4043, confession: "Armenian Orthodox" },
  { name: "Asma Andraous",       prefVotes: 917,  confession: "Greek Orthodox" },
  { name: "Antoine Seryani",     prefVotes: 558,  confession: "Minorities" },
  { name: "Jean Talozian",       prefVotes: 500,  confession: "Armenian Catholic" },
  { name: "Najib Lian",          prefVotes: 391,  confession: "Greek Catholic" },
  { name: "Annie Sevrian",       prefVotes: 277,  confession: "Armenian Orthodox" },
  { name: "Leon Semerjian",      prefVotes: 208,  confession: "Armenian Orthodox" },
  { name: "Ghassan Hasbani",     prefVotes: 7080, confession: "Greek Orthodox" },
  { name: "Michel Pharaon",      prefVotes: 3214, confession: "Greek Catholic" },
  { name: "Jihad Pakradouni",    prefVotes: 2186, confession: "Armenian Orthodox" },
  { name: "Georges Chehwan",     prefVotes: 1684, confession: "Maronite" },
  { name: "Aram Malyan",         prefVotes: 1068, confession: "Armenian Orthodox" },
  { name: "Elie Charabchi",      prefVotes: 727,  confession: "Minorities" },
  { name: "Fadi Nahhas",         prefVotes: 200,  confession: "Greek Catholic" },
  { name: "Paula Yacoubian",     prefVotes: 3524, confession: "Armenian Orthodox" },
  { name: "Ziad Abi Shaker",     prefVotes: 3142, confession: "Maronite" },
  { name: "Ziad Abss",           prefVotes: 514,  confession: "Greek Orthodox" },
  { name: "Cynthia Zarazir",     prefVotes: 486,  confession: "Minorities" },
  { name: "Brigitte Chelbian",   prefVotes: 129,  confession: "Armenian Catholic" },
  { name: "Maggie Nanijian",     prefVotes: 80,   confession: "Armenian Orthodox" },
  { name: "Charles Fakhouri",    prefVotes: 64,   confession: "Greek Catholic" },
  { name: "Diana Ohanian",       prefVotes: 63,   confession: "Armenian Orthodox" },
  { name: "Naji Hayeck",         prefVotes: 4781, confession: "Maronite" },
  { name: "Hagop Terzian",       prefVotes: 2647, confession: "Armenian Orthodox" },
  { name: "Alexander Matossian", prefVotes: 2216, confession: "Armenian Orthodox" },
  { name: "Elie Al Aswad",       prefVotes: 303,  confession: "Maronite" },
  { name: "George Jowflikian",   prefVotes: 286,  confession: "Armenian Orthodox" },
  { name: "Chamoun Chamoun",     prefVotes: 230,  confession: "Minorities" },
  { name: "Carla Boutros",       prefVotes: 137,  confession: "Greek Orthodox" },
  { name: "Serge Malkonian",     prefVotes: 95,   confession: "Armenian Catholic" },
];

let globalId = 100;
const uid = () => `id_${globalId++}`;

const makeFullList = (name, color) => ({
  id: uid(),
  name,
  color,
  type: "full",
  votes: 0,
  candidates: [
    { id: uid(), name: "", confession: "Armenian Orthodox", prefVotes: 0 },
    { id: uid(), name: "", confession: "Armenian Orthodox", prefVotes: 0 },
    { id: uid(), name: "", confession: "Armenian Orthodox", prefVotes: 0 },
    { id: uid(), name: "", confession: "Armenian Catholic", prefVotes: 0 },
    { id: uid(), name: "", confession: "Maronite", prefVotes: 0 },
    { id: uid(), name: "", confession: "Greek Orthodox", prefVotes: 0 },
    { id: uid(), name: "", confession: "Greek Catholic", prefVotes: 0 },
    { id: uid(), name: "", confession: "Minorities", prefVotes: 0 },
  ],
});

const makeVoteOnlyList = (name, color) => ({
  id: uid(),
  name,
  color,
  type: "voteOnly",
  votes: 0,
  candidates: [],
});

const DEFAULT_LISTS = [
  makeFullList("List 1", LIST_COLORS[0]),
  makeFullList("List 2", LIST_COLORS[1]),
  makeFullList("List 3", LIST_COLORS[2]),
  makeFullList("List 4", LIST_COLORS[3]),
  makeFullList("List 5", LIST_COLORS[4]),
  makeFullList("List 6", LIST_COLORS[5]),
];

// ——————— ELECTION ENGINE ———————

function runElection(lists) {
  const validVotes = lists.reduce((s, l) => s + l.votes, 0);
  if (validVotes === 0 || lists.length === 0) return { error: "No valid votes cast.", steps: [] };

  const steps = [];
  steps.push({ title: "Total Valid Votes", detail: `${validVotes.toLocaleString()} valid votes across ${lists.length} list(s).` });

  const quotient = validVotes / TOTAL_SEATS;
  steps.push({
    title: "Electoral Quotient (Hare Quota)",
    detail: `${validVotes.toLocaleString()} ÷ ${TOTAL_SEATS} = ${quotient.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  });

  const qualifying = lists.filter(l => l.votes >= quotient);
  const eliminated = lists.filter(l => l.votes < quotient);

  if (eliminated.length > 0) {
    steps.push({
      title: "Lists Eliminated (Below Quota)",
      detail: eliminated.map(l => `${l.name}: ${l.votes.toLocaleString()} votes (needs ${Math.ceil(quotient).toLocaleString()})`).join("\n"),
    });
  }

  if (qualifying.length === 0) return { error: "No list reached the electoral quotient.", steps };

  steps.push({
    title: "Qualifying Lists",
    detail: qualifying.map(l => `${l.name}: ${l.votes.toLocaleString()} votes`).join("\n"),
  });

  // Use the ORIGINAL quotient (from all valid votes) — Lebanese Law 44/2017.
  // Eliminated lists' votes are simply wasted; the quotient is NOT recalculated.
  const allocation = qualifying.map(l => {
    const wholeSeats = Math.floor(l.votes / quotient);
    const remainder = l.votes - wholeSeats * quotient;
    return { ...l, wholeSeats, remainder, totalSeats: wholeSeats };
  });

  let seatsAllocated = allocation.reduce((s, a) => s + a.wholeSeats, 0);
  let remainingSeats = TOTAL_SEATS - seatsAllocated;

  steps.push({
    title: "Whole Quota Allocation",
    detail: allocation.map(a =>
      `${a.name}: ${a.votes.toLocaleString()} ÷ ${quotient.toLocaleString(undefined, { maximumFractionDigits: 2 })} = ${a.wholeSeats} seat(s) + ${a.remainder.toLocaleString(undefined, { maximumFractionDigits: 0 })} remainder`
    ).join("\n"),
  });

  if (remainingSeats > 0) {
    const sorted = [...allocation].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingSeats && i < sorted.length; i++) {
      sorted[i].totalSeats += 1;
    }
    steps.push({
      title: `Largest Remainder (+${remainingSeats} seat${remainingSeats > 1 ? "s" : ""})`,
      detail: sorted.slice(0, remainingSeats).map(a => `${a.name}: remainder ${a.remainder.toLocaleString(undefined, { maximumFractionDigits: 0 })} → +1 seat`).join("\n"),
    });
  }

  steps.push({
    title: "Seats Per List",
    detail: allocation.map(a => `${a.name}: ${a.totalSeats} seat(s)`).join("\n"),
  });

  const winners = [];
  const confessionalFilled = {};
  CONFESSIONS.forEach(c => confessionalFilled[c] = 0);

  for (const alloc of allocation) {
    if (alloc.totalSeats === 0) continue;
    const listCandidates = alloc.candidates || [];
    const ranked = [...listCandidates].sort((a, b) => b.prefVotes - a.prefVotes);
    let seatsToFill = alloc.totalSeats;

    for (const candidate of ranked) {
      if (seatsToFill <= 0) break;
      const conf = candidate.confession;
      const maxForConf = CONFESSION_SEAT_COUNT[conf] || 0;
      if (confessionalFilled[conf] >= maxForConf) continue;
      confessionalFilled[conf]++;
      seatsToFill--;
      winners.push({ ...candidate, listName: alloc.name, listColor: alloc.color, listId: alloc.id });
    }
  }

  steps.push({
    title: "Elected Candidates",
    detail: winners.map(w => `${w.name || "(unnamed)"} (${w.confession}) — ${w.listName} — ${w.prefVotes.toLocaleString()} pref. votes`).join("\n"),
  });

  const unfilledConfessions = CONFESSIONS.filter(c => confessionalFilled[c] < CONFESSION_SEAT_COUNT[c]);
  if (unfilledConfessions.length > 0) {
    steps.push({
      title: "⚠️ Unfilled Confessional Seats",
      detail: unfilledConfessions.map(c => `${c}: ${confessionalFilled[c]}/${CONFESSION_SEAT_COUNT[c]} filled`).join("\n"),
    });
  }

  return { steps, winners, allocation, quotient: newQuotient, eliminated };
}

// ——————— STYLES ———————

const inputStyle = {
  background: "#0f0f23",
  border: "1px solid #ffffff15",
  borderRadius: 6,
  padding: "7px 10px",
  color: "#e2e8f0",
  fontSize: 12,
  outline: "none",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  width: "100%",
  boxSizing: "border-box",
};

const btnStyle = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  transition: "all 0.15s ease",
};

const iconBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#64748b",
  cursor: "pointer",
  fontSize: 14,
  padding: 2,
  borderRadius: 4,
};

// ——————— COMPONENTS ———————

function FullListCard({ list, onUpdate }) {
  const updateCandidate = (cIdx, field, value) => {
    const newCandidates = [...list.candidates];
    newCandidates[cIdx] = { ...newCandidates[cIdx], [field]: value };
    const newSum = newCandidates.reduce((s, c) => s + c.prefVotes, 0);
    onUpdate({ ...list, candidates: newCandidates, votes: newSum });
  };

  return (
    <div style={{
      background: "#1a1a2e",
      borderRadius: 10,
      border: `2px solid ${list.color}33`,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxSizing: "border-box",
    }}>
      {/* List header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 3,
          background: list.color,
          boxShadow: `0 0 8px ${list.color}66`,
          flexShrink: 0,
        }} />
        <input
          type="text"
          value={list.name}
          onChange={e => onUpdate({ ...list, name: e.target.value })}
          style={{
            ...inputStyle,
            fontSize: 15,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${list.color}44`,
            borderRadius: 0,
            padding: "2px 0",
            width: "100%",
          }}
        />
      </div>

      {/* List votes */}
      {(() => {
        const candidateSum = list.candidates.reduce((s, c) => s + c.prefVotes, 0);
        const diverged = list.votes !== candidateSum;
        return (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
                List Votes
              </label>
              <input
                type="number"
                min={0}
                value={list.votes}
                onChange={e => onUpdate({ ...list, votes: Math.max(0, parseInt(e.target.value) || 0) })}
                style={{ ...inputStyle, textAlign: "right", fontSize: 14, fontWeight: 700 }}
              />
            </div>
            {diverged && candidateSum > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "#64748b" }}>Σ pref: {candidateSum.toLocaleString()}</span>
                <button
                  onClick={() => onUpdate({ ...list, votes: candidateSum })}
                  style={{ fontSize: 9, color: "#fbbf24", background: "none", border: "1px solid #fbbf2433", borderRadius: 4, padding: "1px 6px", cursor: "pointer" }}
                >
                  ↻ sync
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Candidate rows */}
      <div style={{ fontSize: 9, color: "#475569", display: "grid", gridTemplateColumns: "1fr 90px 60px", gap: 4, marginBottom: 4, padding: "0 2px" }}>
        <span>NAME</span><span>CONFESSION</span><span style={{ textAlign: "right" }}>PREF.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {list.candidates.map((c, i) => (
          <div key={c.id} style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 60px",
            gap: 4,
            alignItems: "center",
          }}>
            <input
              type="text"
              list="beirut1-candidates"
              value={c.name}
              onChange={e => {
                const name = e.target.value;
                const known = KNOWN_CANDIDATES.find(k => k.name === name);
                if (known) {
                  const newCandidates = [...list.candidates];
                  newCandidates[i] = { ...newCandidates[i], name: known.name, prefVotes: known.prefVotes, confession: known.confession };
                  const newSum = newCandidates.reduce((s, c) => s + c.prefVotes, 0);
                  onUpdate({ ...list, candidates: newCandidates, votes: newSum });
                } else {
                  updateCandidate(i, "name", name);
                }
              }}
              placeholder={`Candidate ${i + 1}`}
              style={{ ...inputStyle, fontSize: 11, padding: "5px 6px" }}
            />
            <select
              value={c.confession}
              onChange={e => updateCandidate(i, "confession", e.target.value)}
              style={{ ...inputStyle, fontSize: 9, padding: "5px 2px", cursor: "pointer" }}
            >
              {CONFESSIONS.map(cf => (
                <option key={cf} value={cf}>{cf.replace("Armenian ", "Arm.").replace("Greek ", "Gr.")}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={c.prefVotes}
              onChange={e => updateCandidate(i, "prefVotes", Math.max(0, parseInt(e.target.value) || 0))}
              style={{ ...inputStyle, fontSize: 11, padding: "5px 4px", textAlign: "right" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function VoteOnlyListCard({ list, onUpdate }) {
  return (
    <div style={{
      background: "#1a1a2e",
      borderRadius: 10,
      border: `2px solid ${list.color}22`,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      height: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 3,
          background: list.color,
          flexShrink: 0,
        }} />
        <input
          type="text"
          value={list.name}
          onChange={e => onUpdate({ ...list, name: e.target.value })}
          style={{
            ...inputStyle,
            fontSize: 15,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${list.color}44`,
            borderRadius: 0,
            padding: "2px 0",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>
          List Votes
        </label>
        <input
          type="number"
          min={0}
          value={list.votes}
          onChange={e => onUpdate({ ...list, votes: Math.max(0, parseInt(e.target.value) || 0) })}
          style={{ ...inputStyle, textAlign: "right", fontSize: 16, fontWeight: 700 }}
        />
      </div>
      <div style={{ color: "#475569", fontSize: 10, marginTop: 8, fontStyle: "italic" }}>
        Vote-only list (no full candidate data)
      </div>
    </div>
  );
}

function ResultsPanel({ result, comments, setComments }) {
  const printRef = useRef(null);
  const [stepsOpen, setStepsOpen] = useState(false);

  if (!result) return null;
  if (result.error) {
    return (
      <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #ef444444" }}>
        <h3 style={{ color: "#ef4444", margin: 0 }}>⚠ {result.error}</h3>
      </div>
    );
  }

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html><head><title>Beirut I Election Results</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet" />
      <style>
        body { background: #0a0a1a; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; padding: 32px; margin: 0; }
        @media print { body { background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  // Separate winning lists (got seats) and losing lists (no seats)
  const winningListIds = new Set();
  (result.winners || []).forEach(w => winningListIds.add(w.listId));

  const allListsInResult = [...(result.allocation || []), ...(result.eliminated || [])];
  const winningLists = allListsInResult.filter(l => winningListIds.has(l.id));
  const losingLists = allListsInResult.filter(l => !winningListIds.has(l.id));

  return (
    <div>
      {/* ——— COMMENTS (top, outside print area) ——— */}
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, background: "#1a1a2e", borderRadius: 10, padding: 14, border: "1px solid #ffffff0a" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            💬 Analysis Notes
          </div>
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Add your analysis, observations, or notes here..."
            style={{
              ...inputStyle,
              width: "100%",
              minHeight: 80,
              resize: "vertical",
              lineHeight: 1.6,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
        <button onClick={handlePrint} style={{
          ...btnStyle,
          background: "#1e293b",
          border: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          flexShrink: 0,
          alignSelf: "stretch",
        }}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div ref={printRef}>
        {/* Comments shown in print output */}
        {comments && (
          <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "10px 14px", marginBottom: 20, border: "1px solid #334155" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{comments}</div>
          </div>
        )}

        {/* ——— WINNING LISTS (full card, all candidates) ——— */}
        {winningLists.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", color: "#4ade80" }}>
              🏛 Winning Lists
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(winningLists.length, 4)}, 1fr)`, gap: 12, alignItems: "start" }}>
              {winningLists.map((list) => {
                const electedIds = new Set((result.winners || []).filter(w => w.listId === list.id).map(w => w.id));
                return (
                  <div key={list.id} style={{
                    background: "#1a1a2e",
                    borderRadius: 10,
                    border: `2px solid ${list.color}33`,
                    padding: 14,
                    boxSizing: "border-box",
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: list.color, boxShadow: `0 0 8px ${list.color}66`, flexShrink: 0 }} />
                      <div style={{ fontSize: 15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#e2e8f0", flex: 1 }}>
                        {list.name}
                      </div>
                      <div style={{ padding: "2px 8px", borderRadius: 12, background: `${list.color}22`, color: list.color, fontSize: 11, fontWeight: 700 }}>
                        {list.totalSeats} seat{list.totalSeats !== 1 ? "s" : ""}
                      </div>
                    </div>
                    {/* Votes row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>List Votes</span>
                      <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{list.votes.toLocaleString()}</span>
                    </div>
                    {/* Column headers */}
                    <div style={{ fontSize: 9, color: "#475569", display: "grid", gridTemplateColumns: "1fr 90px 60px", gap: 4, marginBottom: 4, padding: "0 2px" }}>
                      <span>NAME</span><span>CONFESSION</span><span style={{ textAlign: "right" }}>PREF.</span>
                    </div>
                    {/* Candidates */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {(list.candidates || []).map((c) => {
                        const elected = electedIds.has(c.id);
                        return (
                          <div key={c.id} style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 90px 60px",
                            gap: 4,
                            alignItems: "center",
                            padding: "4px 6px",
                            borderRadius: 5,
                            background: elected ? "#14532d33" : "transparent",
                            border: elected ? "1px solid #16a34a44" : "1px solid transparent",
                          }}>
                            <span style={{ fontSize: 11, color: elected ? "#4ade80" : "#94a3b8", fontWeight: elected ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {elected && <span style={{ marginRight: 4, fontSize: 9 }}>●</span>}
                              {c.name || `(unnamed)`}
                            </span>
                            <span style={{ fontSize: 9, color: elected ? "#86efac" : "#475569" }}>
                              {c.confession.replace("Armenian ", "Arm.").replace(" ", "Chr.").replace("Greek ", "Gr.")}
                            </span>
                            <span style={{ fontSize: 11, color: elected ? "#4ade80" : "#475569", textAlign: "right", fontWeight: elected ? 700 : 400 }}>
                              {c.prefVotes.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ——— LOSING LISTS (collapsed summary) ——— */}
        {losingLists.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Lists Without Seats
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(losingLists.length, 4)}, 1fr)`, gap: 8 }}>
              {losingLists.map((list) => (
                <div key={list.id} style={{
                  background: "#13131f",
                  borderRadius: 8,
                  border: `1px solid ${list.color}22`,
                  borderLeft: `3px solid ${list.color}66`,
                  padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: list.color, opacity: 0.6 }} />
                    <span style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>{list.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#ef4444", fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: "#ef444415", textTransform: "uppercase" }}>
                      no seats
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#475569" }}>{list.votes.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 1 }}>votes</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ——— SEAT BAR ——— */}
        {result.allocation && (
          <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #ffffff0a" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>Seat Distribution</div>
            <div style={{ display: "flex", gap: 3, height: 36, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
              {result.allocation.map((a, i) => {
                if (a.totalSeats === 0) return null;
                const pct = (a.totalSeats / TOTAL_SEATS) * 100;
                return (
                  <div key={i} style={{ width: `${pct}%`, background: a.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                    {a.totalSeats}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {result.allocation.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{a.name}: {a.totalSeats}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ——— CALCULATION STEPS (collapsible) ——— */}
        <div style={{ background: "#1a1a2e", borderRadius: 10, border: "1px solid #ffffff0a", overflow: "hidden" }}>
          <button
            onClick={() => setStepsOpen(o => !o)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              color: "#94a3b8",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>📋 Calculation Steps</span>
            <span style={{ fontSize: 11, color: "#475569", flex: 1, textAlign: "left" }}>
              {result.steps.length} step{result.steps.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 12, color: "#475569", transform: stepsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
          </button>
          {stepsOpen && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {result.steps.map((step, i) => (
                <div key={i} style={{ padding: "10px 12px", background: "#0f0f23", borderRadius: 6, borderLeft: "3px solid #3b82f6" }}>
                  <div style={{ color: "#93c5fd", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
                    Step {i + 1}: {step.title}
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 12, whiteSpace: "pre-line", lineHeight: 1.5 }}>
                    {step.detail}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioRunner({ lists, onApplyScenario }) {
  const [targetCandidate, setTargetCandidate] = useState("");
  const [scenarios, setScenarios] = useState([]);

  const allCandidates = useMemo(() => {
    const all = [];
    lists.forEach(l => l.candidates.forEach(c => {
      if (c.name.trim()) all.push({ ...c, listName: l.name, listId: l.id });
    }));
    return all;
  }, [lists]);

  const runScenarios = useCallback(() => {
    if (!targetCandidate) return;
    const results = [];
    const baseVotes = lists.reduce((s, l) => s + l.votes, 0);

    let targetList = null;
    let targetCand = null;
    for (const l of lists) {
      for (const c of l.candidates) {
        if (c.id === targetCandidate) { targetList = l; targetCand = c; break; }
      }
    }
    if (!targetList || !targetCand) return;

    // Base
    const baseResult = runElection(lists);
    results.push({
      name: "Current Configuration",
      description: "As currently entered",
      wins: baseResult.winners?.some(w => w.name === targetCand.name),
    });

    // +10%
    {
      const m = lists.map(l => l.id === targetList.id ? { ...l, votes: Math.round(l.votes * 1.1) } : l);
      const r = runElection(m);
      results.push({ name: "List +10% Votes", description: `${targetList.name} gains 10% more votes`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
    }

    // +20%
    {
      const m = lists.map(l => l.id === targetList.id ? { ...l, votes: Math.round(l.votes * 1.2) } : l);
      const r = runElection(m);
      results.push({ name: "List +20% Votes", description: `${targetList.name} gains 20% more votes`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
    }

    // +50% pref
    {
      const m = lists.map(l => ({ ...l, candidates: l.candidates.map(c => c.id === targetCandidate ? { ...c, prefVotes: Math.round(c.prefVotes * 1.5) } : c) }));
      const r = runElection(m);
      results.push({ name: "Candidate +50% Pref", description: `${targetCand.name} gains 50% more preferential votes`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
    }

    // Weakest rival collapses
    {
      const others = lists.filter(l => l.id !== targetList.id && l.votes > 0);
      if (others.length > 0) {
        const smallest = others.reduce((min, l) => l.votes < min.votes ? l : min, others[0]);
        const m = lists.map(l => l.id === smallest.id ? { ...l, votes: 0 } : l);
        const r = runElection(m);
        results.push({ name: "Weakest Rival Collapses", description: `${smallest.name} gets 0 votes`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
      }
    }

    // Intra-list rival
    {
      const sameConf = targetList.candidates.filter(c => c.confession === targetCand.confession && c.id !== targetCandidate && c.prefVotes > targetCand.prefVotes);
      if (sameConf.length > 0) {
        const m = lists.map(l => ({ ...l, candidates: l.candidates.map(c => sameConf.some(sc => sc.id === c.id) ? { ...c, prefVotes: Math.round(targetCand.prefVotes * 0.8) } : c) }));
        const r = runElection(m);
        results.push({ name: "Intra-List Rival Weakens", description: `Same-confession rivals lose support`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
      }
    }

    // Low turnout
    {
      const m = lists.map(l => ({ ...l, votes: Math.round(l.votes * 0.7) }));
      const r = runElection(m);
      results.push({ name: "Low Turnout (-30%)", description: "All lists lose 30% of votes", wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
    }

    // Dominance
    {
      const target45 = Math.round(baseVotes * 0.45);
      const remaining = baseVotes - target45;
      const otherCount = lists.filter(l => l.id !== targetList.id).length;
      const perOther = otherCount > 0 ? Math.round(remaining / otherCount) : 0;
      const m = lists.map(l => l.id === targetList.id ? { ...l, votes: target45 } : { ...l, votes: perOther });
      const r = runElection(m);
      results.push({ name: "List Dominance (45%)", description: `${targetList.name} captures 45% of all votes`, wins: r.winners?.some(w => w.name === targetCand.name), modifiedLists: m });
    }

    setScenarios(results);
  }, [lists, targetCandidate]);

  return (
    <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #f59e0b33" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif", color: "#fbbf24" }}>
        🎯 Scenario Simulator
      </h3>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
        Select a target candidate to explore scenarios for their election.
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select value={targetCandidate} onChange={e => setTargetCandidate(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">— Select a candidate —</option>
          {allCandidates.map(c => <option key={c.id} value={c.id}>{c.name} ({c.confession}) — {c.listName}</option>)}
        </select>
        <button onClick={runScenarios} disabled={!targetCandidate} style={{
          ...btnStyle, background: targetCandidate ? "#f59e0b" : "#f59e0b44",
          color: targetCandidate ? "#000" : "#666", fontWeight: 700, padding: "10px 24px",
        }}>
          Run Scenarios
        </button>
      </div>
      {scenarios.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scenarios.map((s, i) => (
            <div key={i} onClick={() => s.modifiedLists && onApplyScenario(s.modifiedLists)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: "#0f0f23", borderRadius: 8,
                borderLeft: `4px solid ${s.wins ? "#16a34a" : "#ef4444"}`,
                cursor: s.modifiedLists ? "pointer" : "default",
              }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: s.wins ? "#16a34a22" : "#ef444422",
                color: s.wins ? "#4ade80" : "#f87171",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>{s.wins ? "✓" : "✗"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>{s.description}</div>
              </div>
              <div style={{ fontSize: 10, color: s.wins ? "#4ade80" : "#f87171", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                {s.wins ? "WINS" : "LOSES"}
              </div>
              {s.modifiedLists && <div style={{ fontSize: 9, color: "#64748b" }}>click to apply →</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ——————— MAIN APP ———————

export default function App() {
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("setup");
  const [comments, setComments] = useState("");

  const updateList = (idx, updated) => {
    const newLists = [...lists];
    newLists[idx] = updated;
    setLists(newLists);
  };

  const runSim = () => {
    const r = runElection(lists);
    setResult(r);
    setActiveTab("results");
  };

  const applyScenario = (modifiedLists) => {
    setLists(modifiedLists);
    setActiveTab("setup");
  };

  const totalVotes = lists.reduce((s, l) => s + l.votes, 0);
  const quotient = totalVotes > 0 ? totalVotes / TOTAL_SEATS : 0;


  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a1a",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet" />

      {/* Global datalist for known candidates */}
      <datalist id="beirut1-candidates">
        {KNOWN_CANDIDATES.map(k => <option key={k.name} value={k.name} />)}
      </datalist>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
        borderBottom: "1px solid #ffffff0a",
        padding: "20px 24px",
      }}>
        <div style={{ maxWidth: 1800, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <h1 style={{
              margin: 0, fontSize: 26,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 900,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Beirut I</h1>
            <span style={{ color: "#64748b", fontSize: 13 }}>Parliamentary Election Simulator</span>
          </div>
          <div style={{ color: "#475569", fontSize: 10, letterSpacing: 1 }}>
            2026 GENERAL ELECTION · 8 SEATS · HARE QUOTA LARGEST REMAINDER · PROPORTIONAL REPRESENTATION
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
            {[
              { label: "Lists", val: lists.length },
              { label: "Total Votes", val: totalVotes.toLocaleString() },
              { label: "Quotient", val: quotient.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "#fbbf24" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color || "#e2e8f0" }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: "#0f0f23",
        borderBottom: "1px solid #ffffff0a",
        padding: "0 24px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1800, margin: "0 auto", display: "flex", gap: 0 }}>
          {[
            { key: "setup", label: "⚙ Setup" },
            { key: "results", label: "📊 Results" },
            { key: "scenarios", label: "🎯 Scenarios" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: "transparent", border: "none",
              borderBottom: activeTab === tab.key ? "2px solid #fbbf24" : "2px solid transparent",
              padding: "12px 18px",
              color: activeTab === tab.key ? "#fbbf24" : "#64748b",
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 400,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1800, margin: "0 auto", padding: "20px 24px 80px" }}>
        {activeTab === "setup" && (
          <div>
            {/* Run button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={runSim} style={{
                ...btnStyle,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000", fontWeight: 700, fontSize: 15,
                padding: "12px 32px",
                boxShadow: "0 0 24px #f59e0b33",
              }}>▶ Run Election</button>
            </div>

            {/* Confessional key */}
            <div style={{
              background: "#1a1a2e", borderRadius: 8, padding: "10px 14px",
              marginBottom: 16, display: "flex", alignItems: "center",
              gap: 12, flexWrap: "wrap", border: "1px solid #ffffff08",
            }}>
              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Seats:</span>
              {CONFESSIONS.map(c => (
                <span key={c} style={{ fontSize: 11, color: "#94a3b8", padding: "2px 8px", background: "#ffffff08", borderRadius: 4 }}>
                  {c.replace("Armenian ", "Arm.").replace("Greek ", "Gr.")}: <strong style={{ color: "#e2e8f0" }}>{CONFESSION_SEAT_COUNT[c]}</strong>
                </span>
              ))}
            </div>

            {/* All lists — 4 per row, full lists then vote-only */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              alignItems: "start",
            }}>
              {lists.map((list, i) => (
                list.type === "full" ? (
                  <FullListCard
                    key={list.id}
                    list={list}
                    onUpdate={updated => updateList(i, updated)}
                  />
                ) : (
                  <VoteOnlyListCard
                    key={list.id}
                    list={list}
                    onUpdate={updated => updateList(i, updated)}
                  />
                )
              ))}
            </div>
          </div>
        )}

        {activeTab === "results" && (
          <div>
            {result ? (
              <ResultsPanel result={result} comments={comments} setComments={setComments} />
            ) : (
              <div style={{
                background: "#1a1a2e", borderRadius: 12, padding: 40,
                textAlign: "center", border: "1px solid #ffffff0a",
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>No results yet. Set up your lists and run the election.</div>
                <button onClick={() => setActiveTab("setup")} style={{ ...btnStyle, marginTop: 16 }}>Go to Setup</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "scenarios" && (
          <ScenarioRunner lists={lists} onApplyScenario={applyScenario} />
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, #0a0a1a 40%)",
        padding: "40px 24px 12px", textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ color: "#334155", fontSize: 9, letterSpacing: 1 }}>
          BEIRUT I · ACHRAFIEH · RMEIL · SAIFI · MEDAWAR · LAW 44/2017
        </div>
      </div>
    </div>
  );
}