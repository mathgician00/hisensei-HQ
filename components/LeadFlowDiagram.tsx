'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  Calendar,
  UserCheck,
  AlertOctagon,
  Sparkles,
  Phone,
  Tag,
  Clock,
  Filter,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Percent,
  Info,
  DollarSign,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Lead } from '@/src/services/tutoringService';
import { apiFetch } from '@/lib/api';
import {
  calculateLeadFlow,
  computeSankeyLayout,
  LeadFlowResult,
  SankeyLayoutResult,
  PlacedNode,
  PlacedLink,
  FLOW_COLORS,
  ReasonOriginSplit,
} from '@/lib/leadFlow';

interface LeadFlowDiagramProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
  onUpdateStage?: (leadId: string, toStage: string) => void;
  onBookTrial?: (lead: Lead) => void;
  onTrialOutcome?: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
  onMarkLost?: (lead: Lead) => void;
}

export const LeadFlowDiagram: React.FC<LeadFlowDiagramProps> = ({
  leads,
  onSelectLead,
  onUpdateStage,
  onBookTrial,
  onTrialOutcome,
  onConvert,
  onMarkLost,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [fitToScreen, setFitToScreen] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Server-computed lead flow state
  const [serverFlow, setServerFlow] = useState<LeadFlowResult | null>(null);
  const [isLoadingFlow, setIsLoadingFlow] = useState<boolean>(false);

  // 1. Fetch server-authoritative lead flow calculations
  const fetchServerFlow = async (channel: string) => {
    setIsLoadingFlow(true);
    try {
      const res = await apiFetch(`/api/data?type=lead_flow&channel=${channel}`);
      if (res.ok) {
        const data = await res.json();
        setServerFlow(data);
      } else {
        fallbackCalculation(channel);
      }
    } catch {
      fallbackCalculation(channel);
    } finally {
      setIsLoadingFlow(false);
    }
  };

  const fallbackCalculation = (channel: string) => {
    const subset = channel === 'all' ? leads : leads.filter((l) => l.source_channel === channel);
    const flow = calculateLeadFlow(subset as any);
    setServerFlow(flow);
  };

  useEffect(() => {
    fetchServerFlow(activeChannel);
  }, [activeChannel, leads]);

  // If server flow is not yet available, use leads prop
  const currentFlow = useMemo<LeadFlowResult>(() => {
    if (serverFlow) return serverFlow;
    const subset = activeChannel === 'all' ? leads : leads.filter((l) => l.source_channel === activeChannel);
    return calculateLeadFlow(subset as any);
  }, [serverFlow, leads, activeChannel]);

  // Log reconciliation errors if any
  useEffect(() => {
    if (currentFlow && !currentFlow.summary.reconciled) {
      console.error('[LeadFlowDiagram] Flow does not reconcile:', currentFlow.reconciliationErrors);
    }
  }, [currentFlow]);

  // 2. Compute dynamic layout
  const layout = useMemo<SankeyLayoutResult>(() => {
    return computeSankeyLayout(currentFlow, 1460);
  }, [currentFlow]);

  // Tooltip tracking state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    sourceName?: string;
    targetName?: string;
    value: number;
    pctOfSource?: number;
    pctOfTotal: number;
    desc?: string;
    breakdown?: ReasonOriginSplit[];
  } | null>(null);

  // Generate cubic bezier curve for smooth ribbon
  const makeRibbonPath = (link: PlacedLink) => {
    const srcNode = layout.placedNodes.find((n) => n.id === link.source);
    const tgtNode = layout.placedNodes.find((n) => n.id === link.target);
    if (!srcNode || !tgtNode) return '';

    const x1 = srcNode.x + srcNode.w;
    const y1 = link.sourceY0;
    const h1 = link.sourceH;

    const x2 = tgtNode.x;
    const y2 = link.targetY0;
    const h2 = link.targetH;

    const curvature = 0.5;
    const dx = x2 - x1;
    const c1x = x1 + dx * curvature;
    const c2x = x2 - dx * curvature;

    return `
      M ${x1} ${y1}
      C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + h2}
      C ${c2x} ${y2 + h2}, ${c1x} ${y1 + h1}, ${x1} ${y1 + h1}
      Z
    `;
  };

  // Rule 5: Ribbon tooltip formatting: "Price: 5 from Before trial -> 6 total"
  const handleLinkMouseMove = (e: React.MouseEvent, link: PlacedLink) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const srcNode = layout.placedNodes.find((n) => n.id === link.source);
    const tgtNode = layout.placedNodes.find((n) => n.id === link.target);

    const totalLeads = currentFlow.totalLeads;
    const pctOfTotal = totalLeads > 0 ? Math.round((link.value / totalLeads) * 1000) / 10 : 0;

    const originLabel = link.originStage === 'before_contact'
      ? 'Before contact'
      : link.originStage === 'before_trial'
      ? 'Before trial'
      : link.originStage === 'after_trial'
      ? 'After trial'
      : srcNode?.label || link.source;

    const ribbonTitle = link.targetReasonTotal
      ? `${tgtNode?.label.replace(/^Lost:\s*/, '') || 'Reason'}: ${link.value} from ${originLabel} -> ${link.targetReasonTotal} total`
      : link.contextTitle;

    setHoveredLinkId(link.id);
    setTooltip({
      visible: true,
      x,
      y,
      title: ribbonTitle,
      sourceName: srcNode ? srcNode.label : link.source,
      targetName: tgtNode ? tgtNode.label : link.target,
      value: link.value,
      pctOfSource: link.pctOfSource,
      pctOfTotal,
      desc: link.contextDesc,
    });
  };

  // Rule 5: Tooltip on a reason node: its split by origin
  const handleNodeMouseMove = (e: React.MouseEvent, node: PlacedNode) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHoveredNodeId(node.id);
    setTooltip({
      visible: true,
      x,
      y,
      title: node.label,
      value: node.value,
      pctOfTotal: node.pctOfTotal,
      breakdown: node.reasonBreakdown,
    });
  };

  // Rule 7: Connectivity determination for dimming
  const activeFocusNodeId = selectedNodeId || hoveredNodeId;

  const isNodeConnected = (nodeId: string): boolean => {
    if (hoveredLinkId) {
      const link = layout.placedLinks.find((l) => l.id === hoveredLinkId);
      return link ? link.source === nodeId || link.target === nodeId : true;
    }
    if (!activeFocusNodeId) return true;
    if (nodeId === activeFocusNodeId) return true;
    // Check if any link connects activeFocusNodeId with nodeId
    return layout.placedLinks.some(
      (l) =>
        (l.source === activeFocusNodeId && l.target === nodeId) ||
        (l.target === activeFocusNodeId && l.source === nodeId)
    );
  };

  const isLinkConnected = (link: PlacedLink): boolean => {
    if (hoveredLinkId) {
      return link.id === hoveredLinkId;
    }
    if (!activeFocusNodeId) return true;
    return link.source === activeFocusNodeId || link.target === activeFocusNodeId;
  };

  // 3. Click-to-filter selection logic
  const selectedNode = layout.placedNodes.find((n) => n.id === selectedNodeId);

  const selectedLeads = useMemo(() => {
    if (!selectedNodeId || !selectedNode) {
      if (activeChannel === 'all') return leads;
      return leads.filter((l) => l.source_channel === activeChannel);
    }
    const idSet = new Set(selectedNode.leadIds);
    return leads.filter((l) => idSet.has(l.id));
  }, [leads, selectedNodeId, selectedNode, activeChannel]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Controls and Reconciliation Indicator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#ff2e63] font-sans">
                How effective is our lead funnel really?
              </h2>

              {/* Rule 9: Red badge if any node's inflow != outflow */}
              {!currentFlow.summary.reconciled && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-full text-xs font-bold shadow-xs animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flow does not reconcile: {currentFlow.reconciliationErrors.join('; ')}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mutually exclusive Sankey loss accounting: Inbound Leads ➔ Contacted ➔ Trial Attended ➔ Enrolled & Lost Causes by Origin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-stretch lg:self-auto">
            {/* Viewport Scale Controls */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => {
                  setFitToScreen(true);
                  setZoomLevel(100);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  fitToScreen
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Fit diagram entirely within screen without scrolling"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Fit Screen</span>
              </button>
              <button
                onClick={() => setFitToScreen(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !fitToScreen
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Scrollable native scale"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Scrollable</span>
              </button>
            </div>

            {/* Zoom Controls (when in Scrollable Mode) */}
            {!fitToScreen && (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 15, 65))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-slate-800 text-[11px] px-1">
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 15, 160))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-700"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Channel Filter */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-500">Channel:</span>
              <select
                value={activeChannel}
                onChange={(e) => {
                  setActiveChannel(e.target.value);
                  setSelectedNodeId(null);
                }}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="all">All Channels ({leads.length})</option>
                <option value="instagram">Instagram</option>
                <option value="referral">Referral</option>
                <option value="event">School Fair / Event</option>
              </select>
            </div>

            {selectedNodeId && (
              <button
                onClick={() => setSelectedNodeId(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Sankey Canvas Container */}
      <div
        ref={containerRef}
        className={`bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative transition-all ${
          fitToScreen ? 'overflow-hidden w-full' : 'overflow-auto max-h-[78vh]'
        }`}
      >
        <div
          style={{
            width: fitToScreen ? '100%' : `${(layout.svgWidth * zoomLevel) / 100}px`,
            minWidth: fitToScreen ? '100%' : '1240px',
            margin: '0 auto',
          }}
          className="relative"
        >
          <svg
            viewBox={layout.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto select-none block"
            style={{
              maxHeight: fitToScreen ? '72vh' : 'none',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.02))',
            }}
            onMouseLeave={() => {
              setHoveredLinkId(null);
              setHoveredNodeId(null);
              setTooltip(null);
            }}
          >
            {/* White halo styling definition */}
            <defs>
              <filter id="white-halo" x="-10%" y="-10%" width="120%" height="120%">
                <feFlood floodColor="white" result="flood" />
                <feComposite in="SourceGraphic" in2="flood" operator="over" />
              </filter>
            </defs>

            {/* A. Flow Ribbons (Curved Bands) */}
            <g className="sankey-links">
              {layout.placedLinks.map((link) => {
                const isHovered = hoveredLinkId === link.id;
                const pathD = makeRibbonPath(link);

                // Rule 7: Dim everything not connected to 25% opacity
                let opacity = link.opacity; // Default (0.55 for loss origin ribbons, 0.35/0.45 for main/enrolled)
                if (activeFocusNodeId || hoveredLinkId) {
                  const connected = isLinkConnected(link);
                  opacity = connected ? (isHovered ? 0.85 : 0.65) : 0.25;
                }

                return (
                  <path
                    key={link.id}
                    d={pathD}
                    fill={link.color}
                    fillOpacity={opacity}
                    stroke={link.color}
                    strokeWidth={isHovered ? 2 : 0}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseMove={(e) => handleLinkMouseMove(e, link)}
                    onMouseLeave={() => {
                      setHoveredLinkId(null);
                      setTooltip(null);
                    }}
                  />
                );
              })}
            </g>

            {/* B. Vertical Nodes (Bars & Segments) */}
            <g className="sankey-nodes">
              {layout.placedNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const connected = isNodeConnected(node.id);

                // Rule 7: Dim everything not connected to 25% opacity
                const nodeOpacity = (activeFocusNodeId || hoveredLinkId) && !connected ? 0.25 : 1;

                const isLeftCol = node.column === 0;
                const isRightCol = node.column === 5;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer group"
                    style={{ opacity: nodeOpacity }}
                    onClick={() => {
                      if (node.value > 0) {
                        setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                      }
                    }}
                    onMouseMove={(e) => handleNodeMouseMove(e, node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => {
                      setHoveredNodeId(null);
                      setTooltip(null);
                    }}
                  >
                    {/* Rule 5: Split each reason bar into segments with origin colours */}
                    {node.category === 'lost_reason' && node.segments && node.segments.length > 0 ? (
                      <g className="reason-bar-segments">
                        {node.segments.map((seg, sIdx) => (
                          <rect
                            key={sIdx}
                            x={node.x}
                            y={seg.y}
                            width={node.w}
                            height={seg.h}
                            fill={seg.color}
                            className="transition-all duration-150 hover:brightness-110"
                          />
                        ))}
                        {/* Selected / Hover Outline */}
                        <rect
                          x={node.x}
                          y={node.y}
                          width={node.w}
                          height={node.h}
                          rx={3}
                          fill="none"
                          stroke={isSelected ? '#0f172a' : '#ffffff'}
                          strokeWidth={isSelected ? 2 : 1}
                          className="pointer-events-none"
                        />
                      </g>
                    ) : (
                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.w}
                        height={node.h}
                        rx={3}
                        fill={node.color}
                        stroke={isSelected ? '#0f172a' : '#ffffff'}
                        strokeWidth={isSelected ? 2 : 1}
                        className="transition-all duration-150 hover:brightness-110"
                      />
                    )}

                    {/* Rule 8: Node Text Labels with White Halo, min 11px font size */}
                    {isLeftCol ? (
                      // Left Column: Source names to the left of the bar
                      <g className="text-right">
                        <text
                          x={node.x - 14}
                          y={node.y + Math.max(node.h / 2 - 3, 10)}
                          textAnchor="end"
                          className="font-bold"
                          fill="#334155"
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{
                            fontWeight: 800,
                            fontSize: '13px',
                          }}
                        >
                          {node.label}
                        </text>
                        <text
                          x={node.x - 14}
                          y={node.y + Math.max(node.h / 2 + 13, 24)}
                          textAnchor="end"
                          className="font-mono"
                          fill="#64748b"
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ fontSize: '11px', fontWeight: 600 }}
                        >
                          {node.value} ({node.pctOfTotal}% of all)
                        </text>
                      </g>
                    ) : isRightCol ? (
                      // Right Column: Outcomes & Reasons to the right of the bar (Rule 8: no clipping)
                      <g className="text-left">
                        <text
                          x={node.x + node.w + 14}
                          y={node.y + Math.max(node.h / 2 - 3, 10)}
                          textAnchor="start"
                          className="font-bold"
                          fill={node.category === 'enrolled' ? FLOW_COLORS.enrolled : '#334155'}
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{
                            fontWeight: 800,
                            fontSize: '13px',
                          }}
                        >
                          {node.label}
                        </text>
                        <text
                          x={node.x + node.w + 14}
                          y={node.y + Math.max(node.h / 2 + 13, 24)}
                          textAnchor="start"
                          className="font-mono font-bold"
                          fill="#64748b"
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ fontSize: '11px' }}
                        >
                          {node.value} ({node.pctOfTotal}% of all)
                        </text>
                      </g>
                    ) : (
                      // Middle Columns: Position beside the bar with white halo
                      <g className="text-left">
                        <text
                          x={node.x + node.w + 10}
                          y={node.y + Math.min(node.h / 2 - 2, 16)}
                          textAnchor="start"
                          className="font-bold"
                          fill={
                            node.category === 'loss_origin'
                              ? node.color
                              : node.category === 'open'
                              ? FLOW_COLORS.open
                              : FLOW_COLORS.main
                          }
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{
                            fontWeight: 800,
                            fontSize: '12px',
                          }}
                        >
                          {node.label}
                        </text>
                        <text
                          x={node.x + node.w + 10}
                          y={node.y + Math.min(node.h / 2 + 12, 30)}
                          textAnchor="start"
                          className="font-mono"
                          fill="#64748b"
                          stroke="white"
                          strokeWidth={4}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                          style={{ fontSize: '11px', fontWeight: 600 }}
                        >
                          {node.value} ({node.pctOfTotal}% of all)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* C. Rich Interactive Tooltip (Rule 5: Ribbon & Reason breakdowns) */}
          {tooltip && tooltip.visible && (
            <div
              className="absolute z-50 pointer-events-none p-3.5 bg-slate-900/95 text-white rounded-xl shadow-xl backdrop-blur-md border border-slate-700 max-w-sm transition-transform duration-75 text-xs space-y-1.5"
              style={{
                left: `${Math.min(tooltip.x + 14, (containerRef.current?.clientWidth || 800) - 290)}px`,
                top: `${Math.max(tooltip.y - 85, 10)}px`,
              }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5">
                <span className="font-bold text-slate-100">{tooltip.title}</span>
                {tooltip.pctOfSource !== undefined && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-700/50">
                    {tooltip.pctOfSource}% step conv
                  </span>
                )}
              </div>

              {tooltip.sourceName && tooltip.targetName && (
                <div className="text-[11px] text-slate-300 font-medium">
                  <strong className="text-white">{tooltip.sourceName}</strong>
                  <span className="text-slate-400 mx-1.5">➔</span>
                  <strong className="text-white">{tooltip.targetName}</strong>
                </div>
              )}

              <div className="pt-1 flex items-baseline justify-between text-xs">
                <span className="text-lg font-extrabold text-white font-mono">
                  {tooltip.value}{' '}
                  <span className="text-[11px] font-normal text-slate-400">leads</span>
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  {tooltip.pctOfTotal}% of all leads
                </span>
              </div>

              {/* Rule 5: Reason breakdown by origin */}
              {tooltip.breakdown && tooltip.breakdown.length > 0 && (
                <div className="pt-1.5 border-t border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Origin Breakdown:
                  </span>
                  {tooltip.breakdown.map((split, bIdx) => (
                    <div key={bIdx} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: split.color }}
                        />
                        <span className="text-slate-200">{split.originLabel}</span>
                      </div>
                      <span className="font-mono font-bold text-white">
                        {split.count} leads ({split.pctOfReason}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {tooltip.desc && (
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800">
                  {tooltip.desc}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Reconciled Accounting Bar & Legend (Rule 7, Rule 9) */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
          {/* Rule 7: Legend with exact colors */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#64748b]" />
              <span className="font-semibold text-slate-700">Sources</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#4f46e5]" />
              <span className="font-semibold text-slate-700">Main path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#10b981]" />
              <span className="font-semibold text-slate-700">Enrolled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#f59e0b]" />
              <span className="font-semibold text-slate-700">Open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#fda4af]" />
              <span className="font-semibold text-slate-700">Before contact</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#fb7185]" />
              <span className="font-semibold text-slate-700">Before trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#be123c]" />
              <span className="font-semibold text-slate-700">After trial</span>
            </div>
          </div>

          {/* Rule 3 & Rule 9: Reconciled Accounting Footer & Open Footnote */}
          <div className="flex items-center gap-3">
            {/* Rule 3: Zero-value ones in footnote */}
            <span className="text-[11px] font-mono text-slate-500 font-medium">
              {currentFlow.summary.openFootnoteText}
            </span>

            {/* Rule 9: "24 enrolled + 0 open + 6 + 16 + 16 lost = 62 ✓" */}
            <div className="flex items-center gap-2 font-mono text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-slate-800 font-bold">
                {currentFlow.summary.footerText}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Lead Inspector Drawer Below Diagram */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-slate-100 text-slate-800">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-sm">
              {selectedNode
                ? `Filtered Cohort: ${selectedNode.label}`
                : `All Pipeline Leads (${activeChannel === 'all' ? 'All Channels' : activeChannel})`}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-bold">
              {selectedLeads.length} leads
            </span>
          </div>

          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Click any bar above to isolate cohort leads
          </span>
        </div>

        {selectedLeads.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-mono">
            No leads match current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Lead Code</th>
                  <th className="py-2.5 px-3">Student / Guardian</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Lost Reason</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {selectedLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{l.code}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900">{l.name}</div>
                      {l.guardian_name && (
                        <div className="text-[11px] text-slate-400">Parent: {l.guardian_name}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-sans text-[11px] font-medium capitalize">
                        {l.source_channel || 'other'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-sans text-[11px] font-bold ${
                          l.current_stage === 'converted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.current_stage === 'lost'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.current_stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {l.lost_reason ? (
                        <span className="text-rose-700 font-medium capitalize">{l.lost_reason}</span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {onSelectLead && (
                        <button
                          onClick={() => onSelectLead(l)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-sans font-semibold text-[11px] transition-colors"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
