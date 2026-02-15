import { useState, useCallback, useMemo } from "react";

const CONFESSIONAL_SEATS = [
  { id: "armenian_orthodox_1", label: "Armenian Orthodox", confession: "Armenian Orthodox", index: 1 },
  { id: "armenian_orthodox_2", label: "Armenian Orthodox", confession: "Armenian Orthodox", index: 2 },
  { id: "armenian_orthodox_3", label: "Armenian Orthodox", confession: "Armenian Orthodox", index: 3 },
  { id: "armenian_catholic", label: "Armenian Catholic", confession: "Armenian Catholic", index: 1 },
  { id: "maronite", label: "Maronite", confession: "Maronite", index: 1 },
  { id: "greek_orthodox", label: "Greek Orthodox", confession: "Greek Orthodox", index: 1 },
  { id: "greek_catholic", label: "Greek Catholic", confession: "Greek Catholic", index: 1 },
  { id: "minorities", label: "Christian Minorities", confession: "Christian Minorities", index: 1 },
];

const TOTAL_SEATS = 8;

const CONFESSIONS = [
  "Armenian Orthodox",
  "Armenian Catholic",
  "Maronite",
  "Greek Orthodox",
  "Greek Catholic",
  "Christian Minorities",
];

const CONFESSION_SEAT_COUNT = {
  "Armenian Orthodox": 3,
  "Armenian Catholic": 1,
  "Maronite": 1,
  "Greek Orthodox": 1,
  "Greek Catholic": 1,
  "Christian Minorities": 1,
};

const DEFAULT_LISTS = [
  {
    id: "list1",
    name: "List A",
    color: "#2563eb",
    candidates: [
      { id: "c1", name: "Candidate 1", confession: "Armenian Orthodox", prefVotes: 0 },
      { id: "c2", name: "Candidate 2", confession: "Armenian Orthodox", prefVotes: 0 },
      { id: "c3", name: "Candidate 3", confession: "Armenian Orthodox", prefVotes: 0 },
      { id: "c4", name: "Candidate 4", confession: "Armenian Catholic", prefVotes: 0 },
      { id: "c5", name: "Candidate 5", confession: "Maronite", prefVotes: 0 },
      { id: "c6", name: "Candidate 6", confession: "Greek Orthodox", prefVotes: 0 },
      { id: "c7", name: "Candidate 7", confession: "Greek Catholic", prefVotes: 0 },
      { id: "c8", name: "Candidate 8", confession: "Christian Minorities", prefVotes: 0 },
    ],
    votes: 0,
  },
];

const LIST_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0891b2", "#be185d", "#65a30d", "#7c3aed", "#0d9488",
];

let globalId = 100;
const uid = () => `id_${globalId++}`;

function runElection(lists, totalVoters) {
  const validVotes = lists.reduce((s, l) => s + l.votes, 0);
  if (validVotes === 0 || lists.length === 0) return { error: "No valid votes cast.", steps: [] };

  const steps = [];
  steps.push({ title: "Total Valid Votes", detail: `${validVotes.toLocaleString()} valid votes across ${lists.length} list(s).` });

  // Step 1: Electoral Quotient
  const quotient = validVotes / TOTAL_SEATS;
  steps.push({
    title: "Electoral Quotient (Hare Quota)",
    detail: `${validVotes.toLocaleString()} ÷ ${TOTAL_SEATS} = ${quotient.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  });

  // Step 2: Determine qualifying lists (>= 1 full quota)
  const qualifying = lists.filter(l => l.votes >= quotient);
  const eliminated = lists.filter(l => l.votes < quotient);

  if (eliminated.length > 0) {
    steps.push({
      title: "Lists Eliminated (Below Quota)",
      detail: eliminated.map(l => `${l.name}: ${l.votes.toLocaleString()} votes (needs ${Math.ceil(quotient).toLocaleString()})`).join("\n"),
    });
  }

  if (qualifying.length === 0) {
    return { error: "No list reached the electoral quotient.", steps };
  }

  steps.push({
    title: "Qualifying Lists",
    detail: qualifying.map(l => `${l.name}: ${l.votes.toLocaleString()} votes`).join("\n"),
  });

  // Step 3: Recalculate quotient excluding eliminated lists' votes
  const qualifyingVotes = qualifying.reduce((s, l) => s + l.votes, 0);
  const newQuotient = qualifyingVotes / TOTAL_SEATS;
  
  if (eliminated.length > 0) {
    steps.push({
      title: "Recalculated Quotient",
      detail: `${qualifyingVotes.toLocaleString()} ÷ ${TOTAL_SEATS} = ${newQuotient.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    });
  }

  // Step 4: Allocate seats — whole quotas first
  const allocation = qualifying.map(l => {
    const wholeSeats = Math.floor(l.votes / newQuotient);
    const remainder = l.votes - wholeSeats * newQuotient;
    return { ...l, wholeSeats, remainder, totalSeats: wholeSeats };
  });

  let seatsAllocated = allocation.reduce((s, a) => s + a.wholeSeats, 0);
  let remainingSeats = TOTAL_SEATS - seatsAllocated;

  steps.push({
    title: "Whole Quota Allocation",
    detail: allocation.map(a =>
      `${a.name}: ${a.votes.toLocaleString()} ÷ ${newQuotient.toLocaleString(undefined, { maximumFractionDigits: 2 })} = ${a.wholeSeats} seat(s) + ${a.remainder.toLocaleString(undefined, { maximumFractionDigits: 0 })} remainder`
    ).join("\n"),
  });

  // Step 5: Largest remainder allocation
  if (remainingSeats > 0) {
    const sorted = [...allocation].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingSeats && i < sorted.length; i++) {
      sorted[i].totalSeats += 1;
    }
    steps.push({
      title: `Largest Remainder (+${remainingSeats} seat${remainingSeats > 1 ? "s" : ""})`,
      detail: sorted
        .slice(0, remainingSeats)
        .map(a => `${a.name}: remainder ${a.remainder.toLocaleString(undefined, { maximumFractionDigits: 0 })} → +1 seat`)
        .join("\n"),
    });
  }

  steps.push({
    title: "Seats Per List",
    detail: allocation.map(a => `${a.name}: ${a.totalSeats} seat(s)`).join("\n"),
  });

  // Step 6: Within each list, assign candidates to confessional seats by preferential vote
  const winners = [];
  const confessionalFilled = {};
  CONFESSIONS.forEach(c => confessionalFilled[c] = 0);

  // Process each list
  for (const alloc of allocation) {
    if (alloc.totalSeats === 0) continue;
    
    const listCandidates = alloc.candidates || [];
    // Group by confession, sort by pref votes desc
    const byConfession = {};
    listCandidates.forEach(c => {
      if (!byConfession[c.confession]) byConfession[c.confession] = [];
      byConfession[c.confession].push(c);
    });
    Object.values(byConfession).forEach(arr => arr.sort((a, b) => b.prefVotes - a.prefVotes));

    // Collect all candidates ranked by pref votes
    const ranked = [...listCandidates].sort((a, b) => b.prefVotes - a.prefVotes);
    let seatsToFill = alloc.totalSeats;
    const listWinners = [];

    for (const candidate of ranked) {
      if (seatsToFill <= 0) break;
      const conf = candidate.confession;
      const maxForConf = CONFESSION_SEAT_COUNT[conf] || 0;
      if (confessionalFilled[conf] >= maxForConf) continue;
      // Check if this list still has seats
      confessionalFilled[conf]++;
      seatsToFill--;
      listWinners.push({ ...candidate, listName: alloc.name, listColor: alloc.color });
    }
    winners.push(...listWinners);
  }

  // Handle edge case: if some confessional seats unfilled, try filling from remaining lists
  // This is a simplified version — the full algorithm is more complex with cascading

  steps.push({
    title: "Elected Candidates",
    detail: winners.map(w => `${w.name} (${w.confession}) — ${w.listName} — ${w.prefVotes.toLocaleString()} pref. votes`).join("\n"),
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

// ——————— Components ———————

function CandidateRow({ candidate, onChange, onRemove, listColor }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 160px 120px 36px",
      gap: 8,
      alignItems: "center",
      padding: "6px 0",
    }}>
      <input
        type="text"
        value={candidate.name}
        onChange={e => onChange({ ...candidate, name: e.target.value })}
        placeholder="Candidate name"
        style={inputStyle}
      />
      <select
        value={candidate.confession}
        onChange={e => onChange({ ...candidate, confession: e.target.value })}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        {CONFESSIONS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        type="number"
        min={0}
        value={candidate.prefVotes}
        onChange={e => onChange({ ...candidate, prefVotes: Math.max(0, parseInt(e.target.value) || 0) })}
        placeholder="Pref. votes"
        style={{ ...inputStyle, textAlign: "right" }}
      />
      <button onClick={onRemove} style={iconBtnStyle} title="Remove candidate">✕</button>
    </div>
  );
}

function ListCard({ list, index, onUpdate, onRemove, totalLists }) {
  const updateCandidate = (cIdx, updated) => {
    const newCandidates = [...list.candidates];
    newCandidates[cIdx] = updated;
    onUpdate({ ...list, candidates: newCandidates });
  };

  const removeCandidate = (cIdx) => {
    onUpdate({ ...list, candidates: list.candidates.filter((_, i) => i !== cIdx) });
  };

  const addCandidate = () => {
    onUpdate({
      ...list,
      candidates: [
        ...list.candidates,
        { id: uid(), name: "", confession: "Armenian Orthodox", prefVotes: 0 },
      ],
    });
  };

  const confCoverage = {};
  CONFESSIONS.forEach(c => confCoverage[c] = 0);
  list.candidates.forEach(c => { confCoverage[c.confession] = (confCoverage[c.confession] || 0) + 1; });
  const minCandidates = Math.max(3, Math.ceil(TOTAL_SEATS * 0.4));
  const hasEnoughCandidates = list.candidates.length >= minCandidates;

  return (
    <div style={{
      background: "#1a1a2e",
      borderRadius: 12,
      border: `2px solid ${list.color}33`,
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4,
            background: list.color,
            boxShadow: `0 0 12px ${list.color}66`,
          }} />
          <input
            type="text"
            value={list.name}
            onChange={e => onUpdate({ ...list, name: e.target.value })}
            style={{
              ...inputStyle,
              fontSize: 18,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${list.color}44`,
              borderRadius: 0,
              padding: "4px 0",
              width: 220,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" }}>List Votes</label>
            <input
              type="number"
              min={0}
              value={list.votes}
              onChange={e => onUpdate({ ...list, votes: Math.max(0, parseInt(e.target.value) || 0) })}
              style={{ ...inputStyle, width: 110, textAlign: "right", fontSize: 16, fontWeight: 700 }}
            />
          </div>
          {totalLists > 1 && (
            <button onClick={onRemove} style={{ ...iconBtnStyle, color: "#ef4444" }} title="Remove list">✕</button>
          )}
        </div>
      </div>

      {!hasEnoughCandidates && list.candidates.length > 0 && (
        <div style={{
          background: "#7c3aed22",
          border: "1px solid #7c3aed44",
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 12,
          fontSize: 12,
          color: "#c4b5fd",
        }}>
          ⚠ Lists must have at least {minCandidates} candidates (40% of {TOTAL_SEATS} seats, minimum 3)
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 160px 120px 36px",
        gap: 8,
        padding: "0 0 6px 0",
        borderBottom: "1px solid #ffffff0a",
        marginBottom: 4,
      }}>
        <span style={headerLabel}>Name</span>
        <span style={headerLabel}>Confession</span>
        <span style={headerLabel}>Pref. Votes</span>
        <span />
      </div>

      {list.candidates.map((c, i) => (
        <CandidateRow
          key={c.id}
          candidate={c}
          onChange={updated => updateCandidate(i, updated)}
          onRemove={() => removeCandidate(i)}
          listColor={list.color}
        />
      ))}

      <button onClick={addCandidate} style={{
        ...btnStyle,
        background: `${list.color}22`,
        color: list.color,
        border: `1px solid ${list.color}33`,
        marginTop: 8,
        width: "100%",
        fontSize: 13,
      }}>
        + Add Candidate
      </button>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
        {CONFESSIONS.map(c => {
          const needed = CONFESSION_SEAT_COUNT[c];
          const have = confCoverage[c] || 0;
          const ok = have >= needed;
          return (
            <span key={c} style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 20,
              background: ok ? "#16a34a22" : "#ffffff08",
              color: ok ? "#4ade80" : "#64748b",
              border: `1px solid ${ok ? "#16a34a33" : "#ffffff0a"}`,
            }}>
              {c.replace("Armenian ", "Arm. ").replace("Christian ", "Chr. ")}: {have}/{needed}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ResultsPanel({ result }) {
  if (!result) return null;
  if (result.error) {
    return (
      <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #ef444444" }}>
        <h3 style={{ color: "#ef4444", margin: 0 }}>⚠ {result.error}</h3>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Winners */}
      {result.winners && result.winners.length > 0 && (
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #16a34a33" }}>
          <h3 style={{
            margin: "0 0 16px 0",
            fontSize: 20,
            fontFamily: "'Playfair Display', Georgia, serif",
            color: "#4ade80",
          }}>
            🏛 Elected Members of Parliament
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.winners.map((w, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "#0f0f23",
                borderRadius: 8,
                borderLeft: `4px solid ${w.listColor}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `${w.listColor}33`,
                  color: w.listColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{w.confession} · {w.listName}</div>
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
                  {w.prefVotes.toLocaleString()} pref.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seat allocation visual */}
      {result.allocation && (
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #ffffff0a" }}>
          <h3 style={{
            margin: "0 0 16px 0",
            fontSize: 18,
            fontFamily: "'Playfair Display', Georgia, serif",
            color: "#e2e8f0",
          }}>
            Seat Distribution
          </h3>
          <div style={{ display: "flex", gap: 4, marginBottom: 16, height: 40, borderRadius: 8, overflow: "hidden" }}>
            {result.allocation.map((a, i) => {
              if (a.totalSeats === 0) return null;
              const pct = (a.totalSeats / TOTAL_SEATS) * 100;
              return (
                <div key={i} style={{
                  width: `${pct}%`,
                  background: a.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "width 0.5s ease",
                }}>
                  {a.totalSeats}
                </div>
              );
            })}
            {result.eliminated && result.eliminated.map((e, i) => null)}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {result.allocation.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} />
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{a.name}: {a.totalSeats} seat{a.totalSeats !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step by step */}
      <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #ffffff0a" }}>
        <h3 style={{
          margin: "0 0 16px 0",
          fontSize: 18,
          fontFamily: "'Playfair Display', Georgia, serif",
          color: "#e2e8f0",
        }}>
          📋 Calculation Steps
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.steps.map((step, i) => (
            <div key={i} style={{
              padding: "12px 16px",
              background: "#0f0f23",
              borderRadius: 8,
              borderLeft: "3px solid #3b82f6",
            }}>
              <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Step {i + 1}: {step.title}
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 13, whiteSpace: "pre-line", lineHeight: 1.6 }}>
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenarioRunner({ lists, onApplyScenario }) {
  const [targetCandidate, setTargetCandidate] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [running, setRunning] = useState(false);

  const allCandidates = useMemo(() => {
    const all = [];
    lists.forEach(l => l.candidates.forEach(c => {
      if (c.name.trim()) all.push({ ...c, listName: l.name, listId: l.id });
    }));
    return all;
  }, [lists]);

  const runScenarios = useCallback(() => {
    if (!targetCandidate) return;
    setRunning(true);

    const results = [];
    const baseVotes = lists.reduce((s, l) => s + l.votes, 0);
    
    // Find which list the target is on
    let targetList = null;
    let targetCand = null;
    for (const l of lists) {
      for (const c of l.candidates) {
        if (c.id === targetCandidate) {
          targetList = l;
          targetCand = c;
          break;
        }
      }
    }

    if (!targetList || !targetCand) {
      setRunning(false);
      return;
    }

    // Scenario 1: Current state
    const baseResult = runElection(lists, baseVotes);
    const isWinningBase = baseResult.winners?.some(w => w.name === targetCand.name);
    results.push({
      name: "Current Configuration",
      description: "As currently entered",
      wins: isWinningBase,
      result: baseResult,
    });

    // Scenario 2: What if target's list gets 10% more votes
    {
      const modLists = lists.map(l => l.id === targetList.id ? { ...l, votes: Math.round(l.votes * 1.1) } : l);
      const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
      results.push({
        name: "List +10% Votes",
        description: `${targetList.name} gains 10% more list votes`,
        wins: r.winners?.some(w => w.name === targetCand.name),
        result: r,
        modifiedLists: modLists,
      });
    }

    // Scenario 3: What if target's list gets 20% more votes
    {
      const modLists = lists.map(l => l.id === targetList.id ? { ...l, votes: Math.round(l.votes * 1.2) } : l);
      const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
      results.push({
        name: "List +20% Votes",
        description: `${targetList.name} gains 20% more list votes`,
        wins: r.winners?.some(w => w.name === targetCand.name),
        result: r,
        modifiedLists: modLists,
      });
    }

    // Scenario 4: What if target gets 50% more pref votes
    {
      const modLists = lists.map(l => ({
        ...l,
        candidates: l.candidates.map(c =>
          c.id === targetCandidate ? { ...c, prefVotes: Math.round(c.prefVotes * 1.5) } : c
        ),
      }));
      const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
      results.push({
        name: "Candidate +50% Pref Votes",
        description: `${targetCand.name} gains 50% more preferential votes`,
        wins: r.winners?.some(w => w.name === targetCand.name),
        result: r,
        modifiedLists: modLists,
      });
    }

    // Scenario 5: What if the smallest competing list loses all votes (collapses)
    {
      const otherLists = lists.filter(l => l.id !== targetList.id && l.votes > 0);
      if (otherLists.length > 0) {
        const smallest = otherLists.reduce((min, l) => l.votes < min.votes ? l : min, otherLists[0]);
        const modLists = lists.map(l => l.id === smallest.id ? { ...l, votes: 0 } : l);
        const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
        results.push({
          name: `Weakest Rival Collapses`,
          description: `${smallest.name} gets 0 votes (voters abstain/scatter)`,
          wins: r.winners?.some(w => w.name === targetCand.name),
          result: r,
          modifiedLists: modLists,
        });
      }
    }

    // Scenario 6: What if competitor for same confession on same list gets fewer pref votes
    {
      const sameConfOnList = targetList.candidates.filter(
        c => c.confession === targetCand.confession && c.id !== targetCandidate && c.prefVotes > targetCand.prefVotes
      );
      if (sameConfOnList.length > 0) {
        const modLists = lists.map(l => ({
          ...l,
          candidates: l.candidates.map(c => {
            if (sameConfOnList.some(sc => sc.id === c.id)) {
              return { ...c, prefVotes: Math.round(targetCand.prefVotes * 0.8) };
            }
            return c;
          }),
        }));
        const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
        results.push({
          name: "Intra-List Rival Weakens",
          description: `Same-confession rivals on ${targetList.name} lose preferential support`,
          wins: r.winners?.some(w => w.name === targetCand.name),
          result: r,
          modifiedLists: modLists,
        });
      }
    }

    // Scenario 7: Lower turnout (only 70% of votes)
    {
      const modLists = lists.map(l => ({ ...l, votes: Math.round(l.votes * 0.7) }));
      const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
      results.push({
        name: "Low Turnout (-30%)",
        description: "All lists lose 30% of votes uniformly",
        wins: r.winners?.some(w => w.name === targetCand.name),
        result: r,
        modifiedLists: modLists,
      });
    }

    // Scenario 8: Target list dominant (gets 45% of total)
    {
      const target45 = Math.round(baseVotes * 0.45);
      const remaining = baseVotes - target45;
      const otherCount = lists.filter(l => l.id !== targetList.id).length;
      const perOther = otherCount > 0 ? Math.round(remaining / otherCount) : 0;
      const modLists = lists.map(l => l.id === targetList.id ? { ...l, votes: target45 } : { ...l, votes: perOther });
      const r = runElection(modLists, modLists.reduce((s, l) => s + l.votes, 0));
      results.push({
        name: "List Dominance (45%)",
        description: `${targetList.name} captures 45% of all votes`,
        wins: r.winners?.some(w => w.name === targetCand.name),
        result: r,
        modifiedLists: modLists,
      });
    }

    setScenarios(results);
    setRunning(false);
  }, [lists, targetCandidate]);

  return (
    <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, border: "1px solid #f59e0b33" }}>
      <h3 style={{
        margin: "0 0 16px 0",
        fontSize: 20,
        fontFamily: "'Playfair Display', Georgia, serif",
        color: "#fbbf24",
      }}>
        🎯 Scenario Simulator
      </h3>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px 0" }}>
        Select a target candidate to explore what scenarios would lead to their election.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select
          value={targetCandidate}
          onChange={e => setTargetCandidate(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="">— Select a candidate —</option>
          {allCandidates.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.confession}) — {c.listName}</option>
          ))}
        </select>
        <button
          onClick={runScenarios}
          disabled={!targetCandidate || running}
          style={{
            ...btnStyle,
            background: targetCandidate ? "#f59e0b" : "#f59e0b44",
            color: targetCandidate ? "#000" : "#666",
            fontWeight: 700,
            padding: "10px 24px",
          }}
        >
          Run Scenarios
        </button>
      </div>

      {scenarios.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scenarios.map((s, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "#0f0f23",
              borderRadius: 8,
              borderLeft: `4px solid ${s.wins ? "#16a34a" : "#ef4444"}`,
              cursor: s.modifiedLists ? "pointer" : "default",
            }}
              onClick={() => s.modifiedLists && onApplyScenario(s.modifiedLists)}
              title={s.modifiedLists ? "Click to apply this scenario" : ""}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: s.wins ? "#16a34a22" : "#ef444422",
                color: s.wins ? "#4ade80" : "#f87171",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {s.wins ? "✓" : "✗"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{s.description}</div>
              </div>
              <div style={{
                fontSize: 11,
                color: s.wins ? "#4ade80" : "#f87171",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>
                {s.wins ? "WINS" : "LOSES"}
              </div>
              {s.modifiedLists && (
                <div style={{ fontSize: 10, color: "#64748b" }}>click to apply →</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ——————— STYLES ———————

const inputStyle = {
  background: "#0f0f23",
  border: "1px solid #ffffff15",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#e2e8f0",
  fontSize: 13,
  outline: "none",
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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
  fontSize: 16,
  padding: 4,
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const headerLabel = {
  fontSize: 10,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  fontWeight: 600,
};

// ——————— MAIN APP ———————

export default function App() {
  const [lists, setLists] = useState(DEFAULT_LISTS);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("setup"); // setup | results | scenarios

  const addList = () => {
    const idx = lists.length;
    setLists([
      ...lists,
      {
        id: uid(),
        name: `List ${String.fromCharCode(65 + idx)}`,
        color: LIST_COLORS[idx % LIST_COLORS.length],
        candidates: [],
        votes: 0,
      },
    ]);
  };

  const updateList = (idx, updated) => {
    const newLists = [...lists];
    newLists[idx] = updated;
    setLists(newLists);
  };

  const removeList = (idx) => {
    setLists(lists.filter((_, i) => i !== idx));
  };

  const runSim = () => {
    const totalVoters = lists.reduce((s, l) => s + l.votes, 0);
    const r = runElection(lists, totalVoters);
    setResult(r);
    setActiveTab("results");
  };

  const applyScenario = (modifiedLists) => {
    setLists(modifiedLists);
    setActiveTab("setup");
  };

  const loadSampleData = () => {
    setLists([
      {
        id: uid(), name: "Strong Republic", color: "#2563eb", votes: 28000,
        candidates: [
          { id: uid(), name: "Hagop Terzian", confession: "Armenian Orthodox", prefVotes: 8500 },
          { id: uid(), name: "Aram Boyajian", confession: "Armenian Orthodox", prefVotes: 5200 },
          { id: uid(), name: "Sarkis Mamikonian", confession: "Armenian Orthodox", prefVotes: 3100 },
          { id: uid(), name: "Raffi Balian", confession: "Armenian Catholic", prefVotes: 4200 },
          { id: uid(), name: "Pierre Gemayel", confession: "Maronite", prefVotes: 6800 },
          { id: uid(), name: "Georges Khoury", confession: "Greek Orthodox", prefVotes: 5500 },
          { id: uid(), name: "Antoine Saadeh", confession: "Greek Catholic", prefVotes: 4100 },
          { id: uid(), name: "Joseph Sfeir", confession: "Christian Minorities", prefVotes: 2800 },
        ],
      },
      {
        id: uid(), name: "Change Movement", color: "#16a34a", votes: 22000,
        candidates: [
          { id: uid(), name: "Lara Haddad", confession: "Maronite", prefVotes: 7200 },
          { id: uid(), name: "Nayiri Kaloustian", confession: "Armenian Orthodox", prefVotes: 6100 },
          { id: uid(), name: "Viken Parseghian", confession: "Armenian Orthodox", prefVotes: 3800 },
          { id: uid(), name: "Margo Tavitian", confession: "Armenian Orthodox", prefVotes: 2500 },
          { id: uid(), name: "Rita Nazarian", confession: "Armenian Catholic", prefVotes: 4500 },
          { id: uid(), name: "Michel Frem", confession: "Greek Orthodox", prefVotes: 5100 },
          { id: uid(), name: "Carla Boustany", confession: "Greek Catholic", prefVotes: 3200 },
          { id: uid(), name: "David Salibi", confession: "Christian Minorities", prefVotes: 2100 },
        ],
      },
      {
        id: uid(), name: "National Bloc", color: "#dc2626", votes: 15000,
        candidates: [
          { id: uid(), name: "Kevork Ajemian", confession: "Armenian Orthodox", prefVotes: 4500 },
          { id: uid(), name: "Arax Simonian", confession: "Armenian Orthodox", prefVotes: 2800 },
          { id: uid(), name: "Dikran Hovnanian", confession: "Armenian Orthodox", prefVotes: 1900 },
          { id: uid(), name: "Garabed Messerlian", confession: "Armenian Catholic", prefVotes: 3100 },
          { id: uid(), name: "Nadim Makhlouf", confession: "Maronite", prefVotes: 3800 },
          { id: uid(), name: "Elias Nassif", confession: "Greek Orthodox", prefVotes: 2200 },
          { id: uid(), name: "Hanna Abdallah", confession: "Greek Catholic", prefVotes: 1800 },
          { id: uid(), name: "Maroun Chamoun", confession: "Christian Minorities", prefVotes: 1500 },
        ],
      },
      {
        id: uid(), name: "Citizens in a State", color: "#9333ea", votes: 8000,
        candidates: [
          { id: uid(), name: "Jad Youssef", confession: "Maronite", prefVotes: 3200 },
          { id: uid(), name: "Ani Kasparian", confession: "Armenian Orthodox", prefVotes: 2100 },
          { id: uid(), name: "Hrag Basmajian", confession: "Armenian Orthodox", prefVotes: 1400 },
          { id: uid(), name: "Sako Melkonian", confession: "Armenian Catholic", prefVotes: 900 },
        ],
      },
    ]);
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

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
        borderBottom: "1px solid #ffffff0a",
        padding: "24px 32px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <h1 style={{
              margin: 0,
              fontSize: 28,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 900,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Beirut I
            </h1>
            <span style={{ color: "#64748b", fontSize: 14 }}>Parliamentary Election Simulator</span>
          </div>
          <div style={{ color: "#475569", fontSize: 11, letterSpacing: 1 }}>
            2026 GENERAL ELECTION · 8 SEATS · HARE QUOTA LARGEST REMAINDER · PROPORTIONAL REPRESENTATION
          </div>

          {/* Stats bar */}
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Lists</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{lists.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Total Votes</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{totalVotes.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Quotient</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24" }}>{quotient.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Seats</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                {CONFESSIONS.map(c => `${CONFESSION_SEAT_COUNT[c]}${c[0]}`).join(" ")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: "#0f0f23",
        borderBottom: "1px solid #ffffff0a",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 0 }}>
          {[
            { key: "setup", label: "⚙ Setup Lists & Candidates" },
            { key: "results", label: "📊 Election Results" },
            { key: "scenarios", label: "🎯 Scenario Simulator" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #fbbf24" : "2px solid transparent",
                padding: "14px 20px",
                color: activeTab === tab.key ? "#fbbf24" : "#64748b",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 700 : 400,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 80px" }}>
        {activeTab === "setup" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button onClick={addList} style={btnStyle}>+ Add List</button>
              <button onClick={loadSampleData} style={{
                ...btnStyle,
                background: "#1e293b",
                border: "1px solid #334155",
              }}>
                Load Sample Data
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={runSim} style={{
                ...btnStyle,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000",
                fontWeight: 700,
                fontSize: 15,
                padding: "12px 32px",
                boxShadow: "0 0 24px #f59e0b33",
              }}>
                ▶ Run Election
              </button>
            </div>

            {/* Confessional seat key */}
            <div style={{
              background: "#1a1a2e",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              border: "1px solid #ffffff08",
            }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                Confessional Seats:
              </span>
              {CONFESSIONS.map(c => (
                <span key={c} style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "3px 10px",
                  background: "#ffffff08",
                  borderRadius: 4,
                }}>
                  {c}: <strong style={{ color: "#e2e8f0" }}>{CONFESSION_SEAT_COUNT[c]}</strong>
                </span>
              ))}
            </div>

            {lists.map((list, i) => (
              <ListCard
                key={list.id}
                list={list}
                index={i}
                onUpdate={updated => updateList(i, updated)}
                onRemove={() => removeList(i)}
                totalLists={lists.length}
              />
            ))}
          </div>
        )}

        {activeTab === "results" && (
          <div>
            {result ? (
              <ResultsPanel result={result} />
            ) : (
              <div style={{
                background: "#1a1a2e",
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                border: "1px solid #ffffff0a",
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>No results yet. Set up your lists and run the election.</div>
                <button onClick={() => setActiveTab("setup")} style={{ ...btnStyle, marginTop: 16 }}>
                  Go to Setup
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "scenarios" && (
          <ScenarioRunner lists={lists} onApplyScenario={applyScenario} />
        )}
      </div>

      {/* Footer info */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(transparent, #0a0a1a 40%)",
        padding: "40px 32px 16px",
        textAlign: "center",
        pointerEvents: "none",
      }}>
        <div style={{ color: "#334155", fontSize: 10, letterSpacing: 1 }}>
          BEIRUT I · ACHRAFIEH · RMEIL · SAIFI · MEDAWAR · 2017 ELECTORAL LAW (LAW 44/2017)
        </div>
      </div>
    </div>
  );
}
