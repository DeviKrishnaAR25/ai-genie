import { useState, useEffect, useRef } from "react";
import axios from "axios";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";

// ─── Chart Color Palette ───
const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#7c3aed", "#5b21b6", "#4f46e5",
  "#4338ca", "#3730a3"
];

const CLAUSE_COLORS = {
  SELECT:     { bg: "#eef2ff", border: "#6366f1", text: "#4338ca", icon: "📋" },
  FROM:       { bg: "#f0fdf4", border: "#22c55e", text: "#15803d", icon: "🗄️" },
  JOIN:       { bg: "#fefce8", border: "#eab308", text: "#a16207", icon: "🔗" },
  WHERE:      { bg: "#fef2f2", border: "#ef4444", text: "#b91c1c", icon: "🔍" },
  "GROUP BY": { bg: "#f5f3ff", border: "#8b5cf6", text: "#6d28d9", icon: "📊" },
  HAVING:     { bg: "#fff7ed", border: "#f97316", text: "#c2410c", icon: "⚖️" },
  "ORDER BY": { bg: "#ecfeff", border: "#06b6d4", text: "#0e7490", icon: "↕️" },
  LIMIT:      { bg: "#fdf4ff", border: "#d946ef", text: "#a21caf", icon: "✂️" },
  SUBQUERY:   { bg: "#f8fafc", border: "#64748b", text: "#334155", icon: "🔄" },
  WITH:       { bg: "#f1f5f9", border: "#475569", text: "#1e293b", icon: "📝" },
  CASE:       { bg: "#fff1f2", border: "#fb7185", text: "#be123c", icon: "🔀" },
  WINDOW:     { bg: "#f0f9ff", border: "#0ea5e9", text: "#0369a1", icon: "🪟" }
};

function getSessionId() {
  let id = sessionStorage.getItem("genie_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("genie_session_id", id);
  }
  return id;
}

function ChatBox() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(getSessionId());
  const [turnCount, setTurnCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredClause, setHoveredClause] = useState(null);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ─── Ask Question ───
  async function askQuestion() {
    if (!question.trim() || loading) return;
    const userQuestion = question;
    setMessages((prev) => [...prev, { type: "user", text: userQuestion }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post("/chat", {
        question: userQuestion,
        session_id: sessionId
      });
      if (response.data.session_id) {
        setSessionId(response.data.session_id);
        sessionStorage.setItem("genie_session_id", response.data.session_id);
      }
      setMessages((prev) => [...prev, { type: "bot", data: response.data }]);
      setTurnCount((prev) => prev + 1);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { type: "bot", data: { error: "Unable to connect to AI BI Genie backend." } }
      ]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function startNewConversation() {
    axios.delete(`/history/${sessionId}`).catch(() => {});
    const newId = crypto.randomUUID();
    sessionStorage.setItem("genie_session_id", newId);
    setSessionId(newId);
    setMessages([]);
    setTurnCount(0);
  }

  // ─── Table Renderer ───
  function renderTable(rows) {
    if (!rows || rows.length === 0) {
      return (
        <div style={styles.emptyState}>
          <span style={{ fontSize: "24px" }}>📭</span>
          <p style={{ margin: "8px 0 0", color: "#94a3b8" }}>No data available</p>
        </div>
      );
    }
    const columns = Object.keys(rows[0]);
    return (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} style={styles.tableHeader}>
                  {col.replace(/_/g, " ").toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                {columns.map((col) => (
                  <td key={col} style={styles.tableCell}>{String(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── Chart Renderer (with grouped_bar + scatter) ───
  function renderChart(chart) {
    if (!chart) return null;

    // REGULAR BAR
    if (chart.type === "bar") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={chart.xAxis} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <Tooltip contentStyle={styles.tooltipStyle} cursor={{ fill: "rgba(99, 102, 241, 0.08)" }} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey={chart.yAxis} fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={50} />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // GROUPED BAR (YoY comparison)
    if (chart.type === "grouped_bar" && chart.groups) {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={chart.xAxis} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <Tooltip contentStyle={styles.tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {chart.groups.map((group, index) => (
              <Bar
                key={group}
                dataKey={group}
                name={String(group)}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // LINE
    if (chart.type === "line") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={chart.xAxis} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#cbd5e1" }} />
            <Tooltip contentStyle={styles.tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey={chart.yAxis} stroke="#6366f1" strokeWidth={3}
              dot={{ fill: "#6366f1", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, fill: "#4f46e5" }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // PIE
    if (chart.type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={chart.data} dataKey={chart.yAxis} nameKey={chart.xAxis}
              cx="50%" cy="50%" outerRadius={110} innerRadius={55} paddingAngle={3}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={{ stroke: "#94a3b8" }}>
              {chart.data.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={styles.tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // SCATTER (delay vs quantity correlation)
    if (chart.type === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={chart.xAxis}
              name={chart.xAxis.replace(/_/g, " ")}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              label={{ value: chart.xAxis.replace(/_/g, " "), position: "bottom", offset: 0, style: { fill: "#64748b", fontSize: 12 } }}
            />
            <YAxis
              dataKey={chart.yAxis}
              name={chart.yAxis.replace(/_/g, " ")}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              label={{ value: chart.yAxis.replace(/_/g, " "), angle: -90, position: "insideLeft", style: { fill: "#64748b", fontSize: 12 } }}
            />
            <ZAxis range={[40, 400]} />
            <Tooltip
              contentStyle={styles.tooltipStyle}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value, name) => [value, name.replace(/_/g, " ")]}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Scatter
              name={`${chart.xAxis.replace(/_/g, " ")} vs ${chart.yAxis.replace(/_/g, " ")}`}
              data={chart.data}
              fill="#6366f1"
              fillOpacity={0.7}
              stroke="#4f46e5"
              strokeWidth={1}
            />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    return null;
  }

  // ─── SQL Explainability Panel ───
  function renderSqlExplainability(sqlQuery, sqlExplanation) {
    if (!sqlExplanation || !sqlExplanation.clauses || sqlExplanation.clauses.length === 0) {
      return (
        <details style={styles.detailsBlock}>
          <summary style={styles.summaryStyle}>
            <span style={{ fontSize: "14px" }}>🔧</span>
            <span>View SQL</span>
          </summary>
          <pre style={styles.sqlBlock}>{sqlQuery}</pre>
        </details>
      );
    }

    return (
      <details style={styles.detailsBlock}>
        <summary style={styles.summaryStyle}>
          <span style={{ fontSize: "14px" }}>🔧</span>
          <span>Query Explainability</span>
          <span style={styles.clauseCount}>
            {sqlExplanation.clauses.length} clauses
          </span>
        </summary>

        <div style={styles.explainContainer}>
          {/* Summary */}
          <div style={styles.explainSummary}>
            <span style={{ fontSize: "14px" }}>💡</span>
            <span>{sqlExplanation.summary}</span>
          </div>

          {/* SQL with highlight */}
          <div style={styles.sqlHighlightContainer}>
            <p style={styles.sqlHighlightLabel}>GENERATED SQL</p>
            <pre style={{
              ...styles.sqlBlock,
              margin: 0,
              position: "relative"
            }}>
              {hoveredClause
                ? highlightSqlFragment(sqlQuery, hoveredClause)
                : sqlQuery
              }
            </pre>
          </div>

          {/* Clause-by-clause breakdown */}
          <div style={styles.clauseList}>
            <p style={styles.sqlHighlightLabel}>CLAUSE-BY-CLAUSE BREAKDOWN</p>
            {sqlExplanation.clauses.map((clause, index) => {
              const colors = CLAUSE_COLORS[clause.clause_type] || CLAUSE_COLORS.SELECT;
              const isHovered = hoveredClause === clause.sql_fragment;

              return (
                <div
                  key={index}
                  style={{
                    ...styles.clauseCard,
                    borderLeftColor: colors.border,
                    background: isHovered ? colors.bg : "#ffffff",
                    transform: isHovered ? "translateX(4px)" : "none",
                    boxShadow: isHovered
                      ? "0 2px 12px rgba(0,0,0,0.08)"
                      : "0 1px 3px rgba(0,0,0,0.04)"
                  }}
                  onMouseEnter={() => setHoveredClause(clause.sql_fragment)}
                  onMouseLeave={() => setHoveredClause(null)}
                >
                  <div style={styles.clauseHeader}>
                    <span style={{ fontSize: "14px" }}>{colors.icon}</span>
                    <span style={{
                      ...styles.clauseTypeBadge,
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`
                    }}>
                      {clause.clause_type}
                    </span>
                  </div>
                  <code style={styles.clauseFragment}>
                    {clause.sql_fragment}
                  </code>
                  <p style={styles.clauseExplanation}>
                    {clause.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    );
  }

  // Highlight matching SQL fragment
  function highlightSqlFragment(sql, fragment) {
    if (!fragment) return sql;
    const index = sql.indexOf(fragment);
    if (index === -1) return sql;

    return (
      <>
        {sql.substring(0, index)}
        <span style={{
          background: "rgba(99, 102, 241, 0.25)",
          borderRadius: "3px",
          padding: "1px 2px",
          borderBottom: "2px solid #6366f1"
        }}>
          {fragment}
        </span>
        {sql.substring(index + fragment.length)}
      </>
    );
  }

  // ─── Bot Message Renderer ───
  function renderBotMessage(data) {
    if (data.error) {
      return (
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>⚠️</div>
          <div>
            <p style={{ fontWeight: 600, margin: "0 0 4px", color: "#dc2626" }}>Something went wrong</p>
            <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>{data.error}</p>
          </div>
        </div>
      );
    }

    return (
      <div style={styles.botResponseContainer}>
        {/* Answer */}
        <div style={styles.answerCard}>
          <div style={styles.answerHeader}>
            <div style={styles.genieAvatar}>✨</div>
            <span style={styles.answerLabel}>AI BI Genie</span>
          </div>
          <p style={styles.answerText}>{data.answer}</p>
        </div>

        {/* Insights */}
        {data.insights && data.insights.length > 0 && (
          <div style={styles.insightsCard}>
            <div style={styles.sectionHeader}>
              <span style={{ fontSize: "16px" }}>💡</span>
              <span style={styles.sectionTitle}>Key Insights</span>
            </div>
            <div style={styles.insightsList}>
              {data.insights.map((insight, index) => (
                <div key={index} style={styles.insightItem}>
                  <div style={styles.insightBullet}>{index + 1}</div>
                  <p style={styles.insightText}>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart */}
        {data.chart && (
          <div style={styles.chartCard}>
            <div style={styles.sectionHeader}>
              <span style={{ fontSize: "16px" }}>📊</span>
              <span style={styles.sectionTitle}>Visualization</span>
              <span style={styles.chartBadge}>
                {data.chart.type === "grouped_bar" ? "GROUPED BAR" : data.chart.type.toUpperCase()}
              </span>
            </div>
            <div style={{ padding: "10px 0" }}>{renderChart(data.chart)}</div>
          </div>
        )}

        {/* Expandable: Data */}
        <details style={styles.detailsBlock}>
          <summary style={styles.summaryStyle}>
            <span style={{ fontSize: "14px" }}>📋</span>
            <span>View Data</span>
            {data.results && (
              <span style={styles.rowCountBadge}>{data.results.length} rows</span>
            )}
          </summary>
          <div style={{ padding: "12px 0" }}>{renderTable(data.results)}</div>
        </details>

        {/* Expandable: SQL Explainability */}
        {renderSqlExplainability(data.sql_query, data.sql_explanation)}
      </div>
    );
  }

  const suggestions = [
    { icon: "📦", text: "Top 5 suppliers by shipment volume" },
    { icon: "🏭", text: "Show warehouse utilisation" },
    { icon: "📊", text: "Show shipment status distribution" },
    { icon: "⚠️", text: "Show breach rate by supplier" },
    { icon: "📈", text: "Show YoY shipment comparison by supplier" },
    { icon: "🔬", text: "Show delay vs quantity correlation" }
  ];

  // ─── Main Render ───
  return (
    <div style={styles.appContainer}>
      {/* Sidebar */}
      <div style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? "60px" : "280px",
        minWidth: sidebarCollapsed ? "60px" : "280px"
      }}>
        <div style={styles.sidebarHeader}>
          <div style={{ ...styles.logoContainer, justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
            <div style={styles.logoIcon}>⚡</div>
            {!sidebarCollapsed && (
              <div>
                <h2 style={styles.logoTitle}>AI BI Genie</h2>
                <p style={styles.logoSubtitle}>Supply Chain Analytics</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={styles.collapseBtn}>
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            <button onClick={startNewConversation} style={styles.newChatBtn}>
              <span style={{ fontSize: "16px" }}>＋</span>
              <span>New Conversation</span>
            </button>

            <div style={styles.memoryStatus}>
              <div style={{
                ...styles.memoryDot,
                background: turnCount > 0 ? "#22c55e" : "#475569",
                boxShadow: turnCount > 0 ? "0 0 8px rgba(34, 197, 94, 0.5)" : "none"
              }} />
              <span style={styles.memoryText}>
                {turnCount > 0 ? `Memory active · ${turnCount} turn${turnCount > 1 ? "s" : ""}` : "No conversation yet"}
              </span>
            </div>

            <div style={styles.divider} />
            <p style={styles.historyLabel}>HISTORY</p>
            <div style={styles.historyList}>
              {messages.filter((msg) => msg.type === "user").reverse().map((msg, index) => (
                <div key={index} style={styles.historyItem}>
                  <span style={styles.historyIcon}>💬</span>
                  <span style={styles.historyText}>{msg.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!sidebarCollapsed && (
          <div style={styles.sidebarFooter}>
            <div style={styles.divider} />
            <p style={styles.footerText}>Powered by Gemini 2.5 Flash</p>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div style={styles.mainArea}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <h3 style={styles.topBarTitle}>Supply Chain Intelligence</h3>
            <span style={styles.topBarBadge}>
              {turnCount > 0 ? `${turnCount} messages` : "New session"}
            </span>
          </div>
          <div style={styles.topBarRight}>
            <div style={styles.sessionChip}>
              <span style={styles.sessionDot} />
              <span style={styles.sessionText}>Session: {sessionId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={styles.chatArea}>
          {messages.length === 0 && !loading && (
            <div style={styles.welcomeContainer}>
              <div style={styles.welcomeIcon}>⚡</div>
              <h2 style={styles.welcomeTitle}>Welcome to AI BI Genie</h2>
              <p style={styles.welcomeSubtitle}>
                Your intelligent supply chain analytics assistant.
                <br />
                Ask questions naturally — I remember our entire conversation.
              </p>
              <div style={styles.suggestionsGrid}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setQuestion(s.text)} style={styles.suggestionCard}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#f5f3ff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#ffffff"; }}>
                    <span style={styles.suggestionIcon}>{s.icon}</span>
                    <span style={styles.suggestionText}>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} style={styles.messageRow}>
              {msg.type === "user" ? (
                <div style={styles.userMessageRow}>
                  <div style={styles.userBubble}>
                    <p style={styles.userText}>{msg.text}</p>
                  </div>
                  <div style={styles.userAvatar}>👤</div>
                </div>
              ) : (
                <div style={styles.botMessageRow}>
                  <div style={styles.botAvatar}>✨</div>
                  <div style={styles.botContent}>{renderBotMessage(msg.data)}</div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={styles.botMessageRow}>
              <div style={styles.botAvatar}>✨</div>
              <div style={styles.loadingCard}>
                <div style={styles.loadingDots}>
                  <div style={{ ...styles.dot, animationDelay: "0s" }} />
                  <div style={{ ...styles.dot, animationDelay: "0.2s" }} />
                  <div style={{ ...styles.dot, animationDelay: "0.4s" }} />
                </div>
                <span style={styles.loadingText}>Analyzing your data...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          <div style={styles.inputContainer}>
            <input ref={inputRef} value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a supply chain question..."
              style={styles.input}
              onKeyDown={(e) => { if (e.key === "Enter") askQuestion(); }}
              onFocus={(e) => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
            />
            <button onClick={askQuestion} disabled={loading || !question.trim()}
              style={{ ...styles.sendBtn, opacity: loading || !question.trim() ? 0.5 : 1, cursor: loading || !question.trim() ? "not-allowed" : "pointer" }}>
              {loading ? <div style={styles.sendSpinner} /> : <span style={{ fontSize: "18px" }}>➤</span>}
            </button>
          </div>
          <p style={styles.inputHint}>Press Enter to send · AI BI Genie remembers your conversation context</p>
        </div>
      </div>

      <style>
        {`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}
      </style>
    </div>
  );
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const styles = {
  appContainer: {
    display: "flex", height: "100%",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  sidebar: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
    color: "white", display: "flex", flexDirection: "column",
    transition: "all 0.3s ease", overflow: "hidden",
    borderRight: "1px solid rgba(255,255,255,0.05)"
  },
  sidebarHeader: { padding: "20px 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  logoContainer: { display: "flex", alignItems: "center", gap: "12px" },
  logoIcon: {
    width: "36px", height: "36px", borderRadius: "10px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "18px", flexShrink: 0
  },
  logoTitle: { margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" },
  logoSubtitle: { margin: "2px 0 0", fontSize: "11px", color: "#94a3b8", fontWeight: 400 },
  collapseBtn: {
    background: "rgba(255,255,255,0.05)", border: "none", color: "#94a3b8",
    cursor: "pointer", borderRadius: "6px", width: "28px", height: "28px",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", flexShrink: 0
  },
  newChatBtn: {
    margin: "4px 16px 12px", padding: "10px 16px",
    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
    color: "white", border: "none", borderRadius: "10px", cursor: "pointer",
    fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center",
    gap: "8px", justifyContent: "center", transition: "all 0.2s ease"
  },
  memoryStatus: {
    margin: "0 16px 12px", padding: "8px 12px",
    background: "rgba(255,255,255,0.04)", borderRadius: "8px",
    display: "flex", alignItems: "center", gap: "8px"
  },
  memoryDot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, transition: "all 0.3s ease" },
  memoryText: { fontSize: "12px", color: "#94a3b8" },
  divider: { height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 16px 12px" },
  historyLabel: { fontSize: "10px", fontWeight: 700, color: "#475569", letterSpacing: "1.5px", margin: "0 16px 8px" },
  historyList: { flex: 1, overflowY: "auto", padding: "0 16px" },
  historyItem: {
    padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: "8px",
    marginBottom: "6px", fontSize: "12px", color: "#cbd5e1",
    display: "flex", alignItems: "flex-start", gap: "8px", lineHeight: "1.4"
  },
  historyIcon: { fontSize: "12px", flexShrink: 0, marginTop: "1px" },
  historyText: { overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  sidebarFooter: { padding: "8px 16px 16px", marginTop: "auto" },
  footerText: { fontSize: "10px", color: "#475569", textAlign: "center", margin: "8px 0 0" },

  mainArea: { flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", minWidth: 0 },
  topBar: {
    padding: "14px 28px", background: "#ffffff", borderBottom: "1px solid #e2e8f0",
    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
  },
  topBarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  topBarTitle: { margin: 0, fontSize: "15px", fontWeight: 600, color: "#1e293b" },
  topBarBadge: { fontSize: "11px", color: "#6366f1", background: "#eef2ff", padding: "3px 10px", borderRadius: "20px", fontWeight: 500 },
  topBarRight: { display: "flex", alignItems: "center", gap: "12px" },
  sessionChip: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px", background: "#f1f5f9", borderRadius: "20px" },
  sessionDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" },
  sessionText: { fontSize: "11px", color: "#64748b", fontFamily: "monospace" },

  chatArea: { flex: 1, overflowY: "auto", padding: "24px 28px" },

  welcomeContainer: { textAlign: "center", maxWidth: "680px", margin: "60px auto 0", animation: "fadeInUp 0.5s ease" },
  welcomeIcon: {
    width: "64px", height: "64px", borderRadius: "20px",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: "28px", marginBottom: "20px", boxShadow: "0 8px 30px rgba(99, 102, 241, 0.25)"
  },
  welcomeTitle: { fontSize: "26px", fontWeight: 700, color: "#1e293b", margin: "0 0 8px", letterSpacing: "-0.5px" },
  welcomeSubtitle: { fontSize: "15px", color: "#64748b", lineHeight: "1.6", margin: "0 0 32px" },
  suggestionsGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", maxWidth: "560px", margin: "0 auto" },
  suggestionCard: {
    display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px",
    background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px",
    cursor: "pointer", textAlign: "left", transition: "all 0.2s ease", fontSize: "13px"
  },
  suggestionIcon: { fontSize: "20px", flexShrink: 0 },
  suggestionText: { color: "#334155", lineHeight: "1.3" },

  messageRow: { marginBottom: "24px", animation: "fadeInUp 0.3s ease" },
  userMessageRow: { display: "flex", justifyContent: "flex-end", alignItems: "flex-start", gap: "10px" },
  userBubble: {
    background: "linear-gradient(135deg, #6366f1, #7c3aed)", color: "white",
    padding: "12px 18px", borderRadius: "18px 18px 4px 18px", maxWidth: "65%",
    boxShadow: "0 2px 12px rgba(99, 102, 241, 0.2)"
  },
  userText: { margin: 0, fontSize: "14px", lineHeight: "1.5" },
  userAvatar: {
    width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0
  },
  botMessageRow: { display: "flex", alignItems: "flex-start", gap: "10px" },
  botAvatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "14px", flexShrink: 0, marginTop: "4px"
  },
  botContent: { flex: 1, minWidth: 0 },

  botResponseContainer: { display: "flex", flexDirection: "column", gap: "12px" },
  answerCard: {
    background: "#ffffff", padding: "20px", borderRadius: "16px",
    border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
  },
  answerHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" },
  genieAvatar: { fontSize: "16px" },
  answerLabel: { fontSize: "13px", fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px" },
  answerText: { margin: 0, fontSize: "15px", lineHeight: "1.7", color: "#334155" },

  insightsCard: {
    background: "#ffffff", padding: "20px", borderRadius: "16px",
    border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
  },
  sectionHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  sectionTitle: { fontSize: "14px", fontWeight: 700, color: "#1e293b" },
  insightsList: { display: "flex", flexDirection: "column", gap: "10px" },
  insightItem: { display: "flex", alignItems: "flex-start", gap: "12px" },
  insightBullet: {
    width: "22px", height: "22px", borderRadius: "50%",
    background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
    color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "11px", fontWeight: 700, flexShrink: 0, marginTop: "1px"
  },
  insightText: { margin: 0, fontSize: "14px", lineHeight: "1.5", color: "#475569" },

  chartCard: {
    background: "#ffffff", padding: "20px", borderRadius: "16px",
    border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
  },
  chartBadge: {
    fontSize: "10px", fontWeight: 700, color: "#6366f1", background: "#eef2ff",
    padding: "2px 8px", borderRadius: "4px", marginLeft: "auto", letterSpacing: "0.5px"
  },

  detailsBlock: {
    background: "#ffffff", borderRadius: "12px",
    border: "1px solid #e2e8f0", overflow: "hidden"
  },
  summaryStyle: {
    cursor: "pointer", fontWeight: 600, fontSize: "13px", color: "#475569",
    padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px",
    userSelect: "none", listStyle: "none"
  },
  rowCountBadge: { fontSize: "11px", color: "#94a3b8", fontWeight: 400, marginLeft: "auto" },
  clauseCount: { fontSize: "11px", color: "#94a3b8", fontWeight: 400, marginLeft: "auto" },

  // ─── Explainability Panel Styles ───
  explainContainer: { padding: "0 16px 16px" },
  explainSummary: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    padding: "12px 14px", background: "#f8fafc", borderRadius: "10px",
    marginBottom: "14px", fontSize: "13px", color: "#475569", lineHeight: "1.5"
  },
  sqlHighlightContainer: { marginBottom: "14px" },
  sqlHighlightLabel: {
    fontSize: "10px", fontWeight: 700, color: "#94a3b8",
    letterSpacing: "1.2px", margin: "0 0 8px", textTransform: "uppercase"
  },
  sqlBlock: {
    background: "#1e293b", color: "#e2e8f0", padding: "16px",
    margin: "0 12px 12px", borderRadius: "10px", fontSize: "12px",
    lineHeight: "1.6", overflowX: "auto",
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace"
  },
  clauseList: { marginTop: "4px" },
  clauseCard: {
    padding: "12px 14px", borderRadius: "10px", marginBottom: "8px",
    borderLeft: "4px solid #e2e8f0", cursor: "pointer",
    transition: "all 0.2s ease"
  },
  clauseHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" },
  clauseTypeBadge: {
    fontSize: "10px", fontWeight: 700, padding: "2px 8px",
    borderRadius: "4px", letterSpacing: "0.5px"
  },
  clauseFragment: {
    display: "block", fontSize: "12px", color: "#334155",
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    background: "#f1f5f9", padding: "6px 10px", borderRadius: "6px",
    marginBottom: "6px", overflowX: "auto", whiteSpace: "pre-wrap"
  },
  clauseExplanation: {
    margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.4"
  },

  tableWrapper: { overflowX: "auto", padding: "0 12px 12px", maxHeight: "350px", overflowY: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px" },
  tableHeader: {
    padding: "10px 14px", background: "#f1f5f9", color: "#475569",
    fontWeight: 700, fontSize: "11px", letterSpacing: "0.5px",
    textAlign: "left", position: "sticky", top: 0, borderBottom: "2px solid #e2e8f0"
  },
  tableCell: { padding: "10px 14px", borderBottom: "1px solid #f1f5f9", color: "#334155" },

  errorCard: {
    display: "flex", alignItems: "flex-start", gap: "12px",
    padding: "16px 20px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px"
  },
  errorIcon: { fontSize: "20px", flexShrink: 0 },
  emptyState: { textAlign: "center", padding: "24px" },

  loadingCard: {
    display: "flex", alignItems: "center", gap: "14px",
    padding: "16px 20px", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0"
  },
  loadingDots: { display: "flex", gap: "5px" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", animation: "bounce 1.4s infinite ease-in-out both" },
  loadingText: { fontSize: "13px", color: "#64748b" },

  inputArea: { padding: "16px 28px 20px", background: "#ffffff", borderTop: "1px solid #e2e8f0", flexShrink: 0 },
  inputContainer: {
    display: "flex", alignItems: "center", gap: "10px",
    background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: "14px",
    padding: "4px 4px 4px 18px", transition: "all 0.2s ease"
  },
  input: { flex: 1, padding: "12px 0", border: "none", outline: "none", fontSize: "14px", color: "#1e293b", background: "transparent", fontFamily: "inherit" },
  sendBtn: {
    width: "44px", height: "44px", borderRadius: "12px",
    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
    color: "white", border: "none", display: "flex", alignItems: "center",
    justifyContent: "center", transition: "all 0.2s ease", flexShrink: 0
  },
  sendSpinner: {
    width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite"
  },
  inputHint: { margin: "8px 0 0", fontSize: "11px", color: "#94a3b8", textAlign: "center" },
  tooltipStyle: {
    background: "#1e293b", border: "none", borderRadius: "8px",
    color: "#e2e8f0", fontSize: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
  }
};

export default ChatBox;
