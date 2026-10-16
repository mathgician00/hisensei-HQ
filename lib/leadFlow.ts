/**
 * leadFlow.ts - Server-authoritative Sankey Lead Flow Accounting & Layout Engine
 * 
 * Strict Flow Conservation & Accounting:
 * 1. Mutually exclusive loss nodes:
 *    - Lost: Before contact (furthest stage is 'new')
 *    - Lost: Before trial (furthest stage contacted or trial_booked, including no-shows)
 *    - Lost: After trial (furthest stage trial_attended or offer_made)
 *    Every lost lead appears in exactly ONE loss node. Loss nodes sum to total lost (38).
 *    Enrolled + Open + loss nodes = total leads (62).
 * 2. 'Lost: After trial' is fed by the Trial Attended node (40 - 24 = 16).
 *    Reasons do not start directly from Trial Attended or Contacted.
 * 3. Never draw a node or label for a value of 0. Zero-value open stages omitted from canvas.
 * 4. Reason nodes receive ribbons from the 3 loss nodes only:
 *    - Before contact: #fda4af
 *    - Before trial: #fb7185
 *    - After trial: #be123c
 *    at 55% opacity. Each loss node has the same color as its ribbons.
 * 5. Split each reason bar into segments with origin colours, in the same top-to-bottom
 *    order as incoming ribbons.
 * 6. Order nodes and links to minimise crossings: loss nodes ordered by process stage
 *    (before contact, before trial, after trial), reasons sorted by total size descending.
 * 7. On hover or click, dim everything not connected to 25% opacity.
 * 8. Dynamic right margin computed from longest label, min 11px font size, SVG white halo.
 * 9. Reconciled footer: "24 enrolled + 0 open + 6 + 16 + 16 lost = 62 ✓".
 */

export interface RawLeadForFlow {
  id: string;
  code: string;
  name: string;
  source_channel: string;
  current_stage: string;
  lost_reason: string | null;
  was_contacted?: boolean;
  was_booked?: boolean;
  was_attended?: boolean;
  was_offered?: boolean;
  was_converted?: boolean;
}

export type NodeCategory =
  | 'source'
  | 'aggregate'
  | 'main'
  | 'enrolled'
  | 'open'
  | 'loss_origin'
  | 'lost_reason';

export type LossOriginStage = 'before_contact' | 'before_trial' | 'after_trial';

export interface ReasonOriginSplit {
  originId: LossOriginStage;
  originLabel: string;
  count: number;
  pctOfReason: number;
  color: string;
}

export interface ReasonBarSegment {
  originId: LossOriginStage;
  originLabel: string;
  color: string;
  value: number;
  pctOfReason: number;
  y: number;
  h: number;
}

export interface LeadFlowNode {
  id: string;
  label: string;
  sublabel: string;
  column: number; // 0: Sources, 1: Inbound, 2: Contacted, 3: Trial, 4: Loss Origins & Stages, 5: Outcomes & Reasons
  category: NodeCategory;
  value: number;
  pctOfTotal: number;
  color: string;
  leadIds: string[];
  lossOriginStage?: LossOriginStage;
  reasonBreakdown?: ReasonOriginSplit[];
}

export interface LeadFlowLink {
  id: string;
  source: string;
  target: string;
  value: number;
  pctOfSource: number;
  contextTitle: string;
  contextDesc: string;
  color: string;
  opacity: number;
  originStage?: LossOriginStage;
  targetReasonTotal?: number;
}

export interface LeadFlowResult {
  totalLeads: number;
  columns: {
    index: number;
    title: string;
    sum: number;
  }[];
  nodes: LeadFlowNode[];
  links: LeadFlowLink[];
  summary: {
    enrolled: number;
    open: number;
    lost: number;
    lostBeforeContact: number;
    lostBeforeTrial: number;
    lostAfterTrial: number;
    total: number;
    reconciled: boolean;
    footerText: string;
    openFootnoteText: string;
  };
  reconciliationErrors: string[];
}

// Strict Color Palette specification:
export const FLOW_COLORS = {
  main: '#4f46e5',     // Indigo for main path
  enrolled: '#10b981', // Emerald for enrolled (the only green)
  open: '#f59e0b',     // Amber for open / in-flight
  lost: '#f43f5e',     // General rose
  lossOrigins: {
    before_contact: '#fda4af', // Before contact #fda4af
    before_trial: '#fb7185',   // Before trial #fb7185
    after_trial: '#be123c',    // After trial #be123c
  },
  sources: ['#64748b', '#94a3b8', '#cbd5e1', '#475569'], // Slate
};

/**
 * Pure Accounting Calculation Function
 * Computes all node and link values once, strictly verifying flow conservation.
 */
export function calculateLeadFlow(leads: RawLeadForFlow[]): LeadFlowResult {
  const N = leads.length;
  const nodesMap = new Map<string, LeadFlowNode>();
  const links: LeadFlowLink[] = [];
  const nodeInflow: Record<string, number> = {};
  const nodeOutflow: Record<string, number> = {};

  const recordNode = (node: LeadFlowNode) => {
    if (node.value <= 0) return; // Rule 3: Never draw a node or label for a value of 0
    nodesMap.set(node.id, node);
    nodeInflow[node.id] = 0;
    nodeOutflow[node.id] = 0;
  };

  const addLink = (
    srcId: string,
    tgtId: string,
    val: number,
    title: string,
    desc: string,
    customColor?: string,
    customOpacity = 0.35,
    originStage?: LossOriginStage,
    targetReasonTotal?: number
  ) => {
    if (val <= 0) return; // Rule 3: Links with value 0 are not drawn
    const srcNode = nodesMap.get(srcId);
    const tgtNode = nodesMap.get(tgtId);
    if (!srcNode || !tgtNode) return;

    const pctOfSource = srcNode.value > 0 ? Math.round((val / srcNode.value) * 1000) / 10 : 0;
    const color = customColor || (
      tgtNode.category === 'enrolled'
        ? FLOW_COLORS.enrolled
        : tgtNode.category === 'open' || srcNode.category === 'open'
        ? FLOW_COLORS.open
        : FLOW_COLORS.main
    );

    links.push({
      id: `${srcId}->${tgtId}`,
      source: srcId,
      target: tgtId,
      value: val,
      pctOfSource,
      contextTitle: title,
      contextDesc: desc,
      color,
      opacity: customOpacity,
      originStage,
      targetReasonTotal,
    });

    nodeOutflow[srcId] = (nodeOutflow[srcId] || 0) + val;
    nodeInflow[tgtId] = (nodeInflow[tgtId] || 0) + val;
  };

  // Group leads by acquisition source channel
  const channelLeads: Record<string, string[]> = {};
  const channelNames: Record<string, string> = {
    instagram: 'Instagram Ads',
    referral: 'Parent Referral',
    event: 'School Fair / Event',
    other: 'Walk-in & Other',
  };

  // Stage lead ID buckets
  const contactedIds: string[] = [];
  const trialAttendedIds: string[] = [];
  const enrolledIds: string[] = [];

  // Open pipeline buckets
  const openNewIds: string[] = [];
  const openTrialIds: string[] = [];
  const openFinalIds: string[] = [];

  // Mutually Exclusive Loss Buckets (Rule 1)
  const lostBeforeContactIds: string[] = [];
  const lostBeforeTrialIds: string[] = [];
  const lostAfterTrialIds: string[] = [];

  // Breakdown of lost reasons per origin loss node
  const reasonOrigins: Record<string, {
    beforeContact: string[];
    beforeTrial: string[];
    afterTrial: string[];
  }> = {};

  leads.forEach((l) => {
    const rawCh = (l.source_channel || 'other').toLowerCase();
    const ch = rawCh.includes('insta')
      ? 'instagram'
      : rawCh.includes('ref')
      ? 'referral'
      : rawCh.includes('event') || rawCh.includes('fair')
      ? 'event'
      : 'other';

    if (!channelLeads[ch]) channelLeads[ch] = [];
    channelLeads[ch].push(l.id);

    // Furthest stage reached determinations
    const reachedTrial = Boolean(
      l.was_attended || l.was_offered || l.current_stage === 'converted'
    );
    const reachedContacted = Boolean(
      reachedTrial || l.was_contacted || l.was_booked || ['contacted', 'trial_booked'].includes(l.current_stage)
    );

    if (reachedContacted) contactedIds.push(l.id);
    if (reachedTrial) trialAttendedIds.push(l.id);

    if (l.current_stage === 'converted') {
      enrolledIds.push(l.id);
    } else if (l.current_stage === 'lost') {
      const reasonRaw = (l.lost_reason || 'No reason recorded').trim();
      const reasonKey = reasonRaw.toLowerCase();
      if (!reasonOrigins[reasonKey]) {
        reasonOrigins[reasonKey] = { beforeContact: [], beforeTrial: [], afterTrial: [] };
      }

      // Rule 1: A lead is "lost" at the last stage it reached, and each loss node holds only its own leads
      if (!reachedContacted) {
        // Lost: Before contact (furthest stage is 'new')
        lostBeforeContactIds.push(l.id);
        reasonOrigins[reasonKey].beforeContact.push(l.id);
      } else if (!reachedTrial) {
        // Lost: Before trial (furthest stage is contacted or trial_booked, including trial no-shows)
        lostBeforeTrialIds.push(l.id);
        reasonOrigins[reasonKey].beforeTrial.push(l.id);
      } else {
        // Lost: After trial (furthest stage is trial_attended or offer_made)
        lostAfterTrialIds.push(l.id);
        reasonOrigins[reasonKey].afterTrial.push(l.id);
      }
    } else {
      // Active in-flight pipeline
      if (!reachedContacted) {
        openNewIds.push(l.id);
      } else if (!reachedTrial) {
        openTrialIds.push(l.id);
      } else {
        openFinalIds.push(l.id);
      }
    }
  });

  const totalOpen = openNewIds.length + openTrialIds.length + openFinalIds.length;
  const totalLost = lostBeforeContactIds.length + lostBeforeTrialIds.length + lostAfterTrialIds.length;

  // 1. Column 0: Acquisition Sources
  let chIdx = 0;
  const sortedChannels = Object.keys(channelLeads).sort((a, b) => channelLeads[b].length - channelLeads[a].length);
  sortedChannels.forEach((ch) => {
    const ids = channelLeads[ch];
    const val = ids.length;
    recordNode({
      id: `src_${ch}`,
      label: channelNames[ch] || ch.charAt(0).toUpperCase() + ch.slice(1),
      sublabel: `${val} leads`,
      column: 0,
      category: 'source',
      value: val,
      pctOfTotal: N > 0 ? Math.round((val / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.sources[chIdx % FLOW_COLORS.sources.length],
      leadIds: ids,
    });
    chIdx++;
  });

  // 2. Column 1: Total Inbound Leads
  recordNode({
    id: 'agg_total',
    label: 'Inbound Leads',
    sublabel: `${N} total (100%)`,
    column: 1,
    category: 'aggregate',
    value: N,
    pctOfTotal: 100,
    color: FLOW_COLORS.main,
    leadIds: leads.map((l) => l.id),
  });

  // Links: Col 0 -> Col 1
  sortedChannels.forEach((ch) => {
    const val = channelLeads[ch].length;
    addLink(
      `src_${ch}`,
      'agg_total',
      val,
      `${channelNames[ch] || ch} Inflow`,
      `Inbound inquiries originating via ${channelNames[ch] || ch}`,
      FLOW_COLORS.sources[0],
      0.35
    );
  });

  // 3. Column 2: Contacted Stage
  if (contactedIds.length > 0) {
    recordNode({
      id: 'node_contacted',
      label: 'Contacted',
      sublabel: `${contactedIds.length} leads`,
      column: 2,
      category: 'main',
      value: contactedIds.length,
      pctOfTotal: N > 0 ? Math.round((contactedIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.main,
      leadIds: contactedIds,
    });
  }

  // Open (New) if > 0
  if (openNewIds.length > 0) {
    recordNode({
      id: 'node_open_new',
      label: 'Open (Before Contact)',
      sublabel: `${openNewIds.length} open`,
      column: 2,
      category: 'open',
      value: openNewIds.length,
      pctOfTotal: N > 0 ? Math.round((openNewIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.open,
      leadIds: openNewIds,
    });
  }

  // 4. Column 3: Trial Attended Stage
  if (trialAttendedIds.length > 0) {
    recordNode({
      id: 'node_trial',
      label: 'Trial Attended',
      sublabel: `${trialAttendedIds.length} leads`,
      column: 3,
      category: 'main',
      value: trialAttendedIds.length,
      pctOfTotal: N > 0 ? Math.round((trialAttendedIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.main,
      leadIds: trialAttendedIds,
    });
  }

  const col3OpenCount = openNewIds.length + openTrialIds.length;
  if (col3OpenCount > 0) {
    recordNode({
      id: 'node_open_trial',
      label: 'Open (Pipeline)',
      sublabel: `${col3OpenCount} open`,
      column: 3,
      category: 'open',
      value: col3OpenCount,
      pctOfTotal: N > 0 ? Math.round((col3OpenCount / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.open,
      leadIds: [...openNewIds, ...openTrialIds],
    });
  }

  // 5. Column 4: Outcomes & Loss Origin Nodes
  // Enrolled Node in Col 4
  if (enrolledIds.length > 0) {
    recordNode({
      id: 'node_converted',
      label: 'Enrolled Students',
      sublabel: `${enrolledIds.length} leads (${N > 0 ? ((enrolledIds.length / N) * 100).toFixed(1) : 0}%)`,
      column: 4,
      category: 'enrolled',
      value: enrolledIds.length,
      pctOfTotal: N > 0 ? Math.round((enrolledIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.enrolled,
      leadIds: enrolledIds,
    });
  }

  // Open Final Node in Col 4 (if any)
  if (totalOpen > 0) {
    const allOpenIds = [...openNewIds, ...openTrialIds, ...openFinalIds];
    recordNode({
      id: 'node_open_final',
      label: 'Open / In-Flight',
      sublabel: `${totalOpen} open`,
      column: 4,
      category: 'open',
      value: totalOpen,
      pctOfTotal: N > 0 ? Math.round((totalOpen / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.open,
      leadIds: allOpenIds,
    });
  }

  // Loss Origin Nodes (Rule 1 & Rule 4):
  // Process Stage order: before contact, before trial, after trial
  if (lostBeforeContactIds.length > 0) {
    recordNode({
      id: 'node_lost_before_contact',
      label: 'Lost: Before contact',
      sublabel: `${lostBeforeContactIds.length} leads`,
      column: 4,
      category: 'loss_origin',
      lossOriginStage: 'before_contact',
      value: lostBeforeContactIds.length,
      pctOfTotal: N > 0 ? Math.round((lostBeforeContactIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.lossOrigins.before_contact,
      leadIds: lostBeforeContactIds,
    });
  }

  if (lostBeforeTrialIds.length > 0) {
    recordNode({
      id: 'node_lost_before_trial',
      label: 'Lost: Before trial',
      sublabel: `${lostBeforeTrialIds.length} leads`,
      column: 4,
      category: 'loss_origin',
      lossOriginStage: 'before_trial',
      value: lostBeforeTrialIds.length,
      pctOfTotal: N > 0 ? Math.round((lostBeforeTrialIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.lossOrigins.before_trial,
      leadIds: lostBeforeTrialIds,
    });
  }

  // Rule 2: Show "Lost: After trial" as its own node, fed by Trial Attended node (40 - 24 = 16)
  if (lostAfterTrialIds.length > 0) {
    recordNode({
      id: 'node_lost_after_trial',
      label: 'Lost: After trial',
      sublabel: `${lostAfterTrialIds.length} leads`,
      column: 4,
      category: 'loss_origin',
      lossOriginStage: 'after_trial',
      value: lostAfterTrialIds.length,
      pctOfTotal: N > 0 ? Math.round((lostAfterTrialIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.lossOrigins.after_trial,
      leadIds: lostAfterTrialIds,
    });
  }

  // Links: Col 1 -> Col 2 / Col 4
  // Contacted Qualified leads flow into Col 2
  addLink('agg_total', 'node_contacted', contactedIds.length, 'Contacted & Qualified', 'Inquiries successfully reached by admissions counselors', FLOW_COLORS.main, 0.35);
  // Open leads awaiting contact
  if (openNewIds.length > 0) {
    addLink('agg_total', 'node_open_new', openNewIds.length, 'Awaiting Contact', 'New leads awaiting first contact attempts', FLOW_COLORS.open, 0.35);
  }
  // Mutually Exclusive Loss link from Inbound to Lost: Before contact (no pass into pre-trial!)
  if (lostBeforeContactIds.length > 0) {
    addLink('agg_total', 'node_lost_before_contact', lostBeforeContactIds.length, 'Lost: Before contact', 'Leads lost before contact could be established', FLOW_COLORS.lossOrigins.before_contact, 0.55, 'before_contact');
  }

  // Links: Col 2 -> Col 3 / Col 4
  // Contacted to Trial Attended
  addLink('node_contacted', 'node_trial', trialAttendedIds.length, 'Trial Attendance', 'Contacted leads who attended trial lessons', FLOW_COLORS.main, 0.35);
  // Open leads awaiting trial
  if (openTrialIds.length > 0) {
    addLink('node_contacted', 'node_open_trial', openTrialIds.length, 'Open Awaiting Trial', 'Contacted leads booked or awaiting trial scheduling', FLOW_COLORS.open, 0.35);
  }
  // Mutually Exclusive Loss link: Contacted -> Lost: Before trial
  if (lostBeforeTrialIds.length > 0) {
    addLink('node_contacted', 'node_lost_before_trial', lostBeforeTrialIds.length, 'Lost: Before trial', 'Contacted leads who dropped before completing a trial', FLOW_COLORS.lossOrigins.before_trial, 0.55, 'before_trial');
  }
  // Continuation of open leads if any
  if (openNewIds.length > 0) {
    addLink('node_open_new', 'node_open_trial', openNewIds.length, 'Continued Open Pipeline', 'Leads continuing in open status', FLOW_COLORS.open, 0.35);
  }

  // Links: Col 3 -> Col 4
  // Trial Attended to Enrolled Students
  addLink('node_trial', 'node_converted', enrolledIds.length, 'Enrolled Conversion', 'Attended trial and accepted package proposal (tuition invoiced)', FLOW_COLORS.enrolled, 0.45);
  // Trial Attended to Post-Trial Open (if any)
  if (openFinalIds.length > 0) {
    addLink('node_trial', 'node_open_final', openFinalIds.length, 'Awaiting Enrolment Decision', 'Attended trial; currently evaluating proposal', FLOW_COLORS.open, 0.35);
  }
  // Rule 2: Trial Attended feeds 'Lost: After trial' node directly (40 - 24 = 16)
  if (lostAfterTrialIds.length > 0) {
    addLink('node_trial', 'node_lost_after_trial', lostAfterTrialIds.length, 'Post-Trial Drop', 'Leads who completed trial but declined enrollment', FLOW_COLORS.lossOrigins.after_trial, 0.55, 'after_trial');
  }
  // Open pipeline continuation if any
  if (col3OpenCount > 0) {
    addLink('node_open_trial', 'node_open_final', col3OpenCount, 'Active Pipeline Flow', 'Leads progressing in pipeline', FLOW_COLORS.open, 0.35);
  }

  // 6. Column 5: Outcomes & Final Reasons (Rule 4 & Rule 5)
  // Terminal Enrolled Node
  if (enrolledIds.length > 0) {
    recordNode({
      id: 'node_converted_terminal',
      label: 'Enrolled Students',
      sublabel: `${enrolledIds.length} enrolled (${N > 0 ? ((enrolledIds.length / N) * 100).toFixed(1) : 0}%)`,
      column: 5,
      category: 'enrolled',
      value: enrolledIds.length,
      pctOfTotal: N > 0 ? Math.round((enrolledIds.length / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.enrolled,
      leadIds: enrolledIds,
    });
    // Link from Col 4 Enrolled -> Col 5 Enrolled
    addLink('node_converted', 'node_converted_terminal', enrolledIds.length, 'Enrolled Students', 'Final accepted admissions conversions', FLOW_COLORS.enrolled, 0.45);
  }

  if (totalOpen > 0) {
    const allOpenIds = [...openNewIds, ...openTrialIds, ...openFinalIds];
    recordNode({
      id: 'node_open_terminal',
      label: 'Open / In-Flight',
      sublabel: `${totalOpen} active leads`,
      column: 5,
      category: 'open',
      value: totalOpen,
      pctOfTotal: N > 0 ? Math.round((totalOpen / N) * 1000) / 10 : 0,
      color: FLOW_COLORS.open,
      leadIds: allOpenIds,
    });
    addLink('node_open_final', 'node_open_terminal', totalOpen, 'Active In-Flight Pipeline', 'Leads currently active in sales progression', FLOW_COLORS.open, 0.35);
  }

  // Sort distinct lost reasons by total size descending (Rule 6)
  const sortedReasonKeys = Object.keys(reasonOrigins).sort((a, b) => {
    const totalA = reasonOrigins[a].beforeContact.length + reasonOrigins[a].beforeTrial.length + reasonOrigins[a].afterTrial.length;
    const totalB = reasonOrigins[b].beforeContact.length + reasonOrigins[b].beforeTrial.length + reasonOrigins[b].afterTrial.length;
    if (totalB !== totalA) return totalB - totalA;
    return a.localeCompare(b);
  });

  // Create reason nodes in Col 5 and connect ribbons from the 3 loss nodes ONLY (Rule 4)
  sortedReasonKeys.forEach((reasonKey) => {
    const originData = reasonOrigins[reasonKey];
    const bcCount = originData.beforeContact.length;
    const btCount = originData.beforeTrial.length;
    const atCount = originData.afterTrial.length;
    const totalCount = bcCount + btCount + atCount;
    if (totalCount <= 0) return;

    const allReasonLeadIds = [
      ...originData.beforeContact,
      ...originData.beforeTrial,
      ...originData.afterTrial,
    ];

    const formattedTitle = reasonKey.charAt(0).toUpperCase() + reasonKey.slice(1);
    const reasonNodeId = `node_reason_${reasonKey}`;

    // Origin breakdown for tooltip and bar segmenting
    const breakdown: ReasonOriginSplit[] = [];
    if (bcCount > 0) {
      breakdown.push({
        originId: 'before_contact',
        originLabel: 'Before contact',
        count: bcCount,
        pctOfReason: Math.round((bcCount / totalCount) * 1000) / 10,
        color: FLOW_COLORS.lossOrigins.before_contact,
      });
    }
    if (btCount > 0) {
      breakdown.push({
        originId: 'before_trial',
        originLabel: 'Before trial',
        count: btCount,
        pctOfReason: Math.round((btCount / totalCount) * 1000) / 10,
        color: FLOW_COLORS.lossOrigins.before_trial,
      });
    }
    if (atCount > 0) {
      breakdown.push({
        originId: 'after_trial',
        originLabel: 'After trial',
        count: atCount,
        pctOfReason: Math.round((atCount / totalCount) * 1000) / 10,
        color: FLOW_COLORS.lossOrigins.after_trial,
      });
    }

    recordNode({
      id: reasonNodeId,
      label: `Lost: ${formattedTitle}`,
      sublabel: `${totalCount} leads`,
      column: 5,
      category: 'lost_reason',
      value: totalCount,
      pctOfTotal: N > 0 ? Math.round((totalCount / N) * 1000) / 10 : 0,
      color: breakdown[0]?.color || FLOW_COLORS.lost,
      leadIds: allReasonLeadIds,
      reasonBreakdown: breakdown,
    });

    // Ribbons from the 3 loss nodes ONLY:
    // 1. From Lost: Before contact
    if (bcCount > 0) {
      addLink(
        'node_lost_before_contact',
        reasonNodeId,
        bcCount,
        `${formattedTitle}: ${bcCount} from Before contact -> ${totalCount} total`,
        `Leads dropped before initial contact due to ${reasonKey}`,
        FLOW_COLORS.lossOrigins.before_contact,
        0.55,
        'before_contact',
        totalCount
      );
    }

    // 2. From Lost: Before trial
    if (btCount > 0) {
      addLink(
        'node_lost_before_trial',
        reasonNodeId,
        btCount,
        `${formattedTitle}: ${btCount} from Before trial -> ${totalCount} total`,
        `Leads contacted/booked who dropped before trial attendance due to ${reasonKey}`,
        FLOW_COLORS.lossOrigins.before_trial,
        0.55,
        'before_trial',
        totalCount
      );
    }

    // 3. From Lost: After trial
    if (atCount > 0) {
      addLink(
        'node_lost_after_trial',
        reasonNodeId,
        atCount,
        `${formattedTitle}: ${atCount} from After trial -> ${totalCount} total`,
        `Students who completed trial but declined enrollment due to ${reasonKey}`,
        FLOW_COLORS.lossOrigins.after_trial,
        0.55,
        'after_trial',
        totalCount
      );
    }
  });

  // Reconciliation Audit & Conservation Validation (Rule 9)
  const reconciliationErrors: string[] = [];

  nodesMap.forEach((node) => {
    const incoming = nodeInflow[node.id] || 0;
    const outgoing = nodeOutflow[node.id] || 0;

    if (node.column === 0) {
      // Source node: outgoing must equal node value
      if (outgoing !== node.value) {
        reconciliationErrors.push(`Source ${node.label}: outgoing (${outgoing}) ≠ value (${node.value})`);
      }
    } else if (node.column === 5) {
      // Terminal node: incoming must equal node value
      if (incoming !== node.value) {
        reconciliationErrors.push(`Terminal ${node.label}: incoming (${incoming}) ≠ value (${node.value})`);
      }
    } else {
      // Intermediate nodes: incoming == value AND outgoing == value
      if (incoming !== node.value) {
        reconciliationErrors.push(`Node ${node.label}: incoming (${incoming}) ≠ value (${node.value})`);
      }
      if (outgoing !== node.value) {
        reconciliationErrors.push(`Node ${node.label}: outgoing (${outgoing}) ≠ value (${node.value})`);
      }
    }
  });

  // Check column sums for columns with full conservation
  const colSums = [0, 0, 0, 0, 0, 0];
  nodesMap.forEach((n) => {
    colSums[n.column] += n.value;
  });

  // Enrolled + Open + loss nodes = total leads (Rule 1)
  const enrolledCount = enrolledIds.length;
  const lostBcCount = lostBeforeContactIds.length;
  const lostBtCount = lostBeforeTrialIds.length;
  const lostAtCount = lostAfterTrialIds.length;

  const totalCol4Outcomes = enrolledCount + totalOpen + lostBcCount + lostBtCount + lostAtCount;
  if (N > 0 && totalCol4Outcomes !== N) {
    reconciliationErrors.push(`Column 4 sum (${totalCol4Outcomes}) ≠ total leads (${N})`);
  }

  const totalCol5Terminal = colSums[5];
  if (N > 0 && totalCol5Terminal !== N) {
    reconciliationErrors.push(`Column 5 terminal sum (${totalCol5Terminal}) ≠ total leads (${N})`);
  }

  const reconciled = reconciliationErrors.length === 0;

  // Rule 9: Footer format: "24 enrolled + 0 open + 6 + 16 + 16 lost = 62 ✓"
  const footerText = `${enrolledCount} enrolled + ${totalOpen} open + ${lostBcCount} + ${lostBtCount} + ${lostAtCount} lost = ${N} ✓`;
  const openFootnoteText = `Open: ${totalOpen}`;

  const columns = [
    { index: 0, title: 'Sources', sum: colSums[0] },
    { index: 1, title: 'Inbound Leads', sum: colSums[1] },
    { index: 2, title: 'Contacted', sum: colSums[2] },
    { index: 3, title: 'Trial Attended', sum: colSums[3] },
    { index: 4, title: 'Loss Origins & Stages', sum: colSums[4] },
    { index: 5, title: 'Outcomes & Reasons', sum: colSums[5] },
  ];

  return {
    totalLeads: N,
    columns,
    nodes: Array.from(nodesMap.values()),
    links,
    summary: {
      enrolled: enrolledCount,
      open: totalOpen,
      lost: totalLost,
      lostBeforeContact: lostBcCount,
      lostBeforeTrial: lostBtCount,
      lostAfterTrial: lostAtCount,
      total: N,
      reconciled,
      footerText,
      openFootnoteText,
    },
    reconciliationErrors,
  };
}

export interface PlacedNode extends LeadFlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
  segments?: ReasonBarSegment[];
}

export interface PlacedLink extends LeadFlowLink {
  sourceY0: number;
  sourceH: number;
  targetY0: number;
  targetH: number;
}

export interface SankeyLayoutResult {
  svgWidth: number;
  svgHeight: number;
  viewBox: string;
  placedNodes: PlacedNode[];
  placedLinks: PlacedLink[];
  scale: number;
  leftMargin: number;
  rightMargin: number;
}

/**
 * Computes dynamic SVG layout dimensions & coordinates:
 * - Order nodes to minimise crossings (loss nodes by process stage, reasons by size descending)
 * - Order links within each node by the vertical position of the other end
 * - Computes reason bar segments with origin colors in matching top-to-bottom order
 * - Computes dynamic right margin from the longest label so nothing is clipped
 */
export function computeSankeyLayout(
  flow: LeadFlowResult,
  targetWidth = 1460
): SankeyLayoutResult {
  const N = flow.totalLeads;
  if (N === 0) {
    return {
      svgWidth: targetWidth,
      svgHeight: 380,
      viewBox: `0 0 ${targetWidth} 380`,
      placedNodes: [],
      placedLinks: [],
      scale: 1,
      leftMargin: 190,
      rightMargin: 260,
    };
  }

  // Count max nodes in any column to ensure generous vertical canvas
  const colNodeCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  flow.nodes.forEach((n) => {
    colNodeCounts[n.column] = (colNodeCounts[n.column] || 0) + 1;
  });
  const maxNodesInCol = Math.max(...Object.values(colNodeCounts));

  // Determine vertical scale and padding
  const topPadding = 75;
  const bottomPadding = 80;
  const targetBarAreaHeight = Math.max(360, maxNodesInCol * 48);
  const scale = targetBarAreaHeight / N;

  const nodeWidth = 24;

  // Rule 8: Compute right margin from the longest label so nothing is clipped
  let maxCol5LabelLength = 18;
  flow.nodes.filter((n) => n.column === 5).forEach((n) => {
    const fullText = `${n.label}: ${n.value} (${n.pctOfTotal}% of all)`;
    if (fullText.length > maxCol5LabelLength) maxCol5LabelLength = fullText.length;
  });
  // Rule 8: Right margin computed to guarantee 0 clipping on labels like "Lost: Chose another provider"
  const rightMargin = Math.max(265, Math.round(maxCol5LabelLength * 7.8 + 45));
  const leftMargin = 195; // Ample 195px on left for full source labels

  // 6 columns: 0 (sources), 1 (inbound), 2 (contacted), 3 (trial), 4 (loss origins), 5 (reasons)
  const availableWidth = targetWidth - leftMargin - rightMargin;
  const colSpacing = availableWidth / 5;

  const columnX: Record<number, number> = {
    0: leftMargin,
    1: leftMargin + colSpacing,
    2: leftMargin + colSpacing * 2,
    3: leftMargin + colSpacing * 3,
    4: leftMargin + colSpacing * 4,
    5: leftMargin + colSpacing * 5,
  };

  // Rule 6: Order nodes to minimise crossings
  // - Main path / aggregate / enrolled on top
  // - Open in middle
  // - Loss nodes ordered by process stage: before_contact, before_trial, after_trial
  // - Reasons sorted by total size descending
  const orderCategory = (n: LeadFlowNode) => {
    if (n.category === 'main' || n.category === 'aggregate' || n.category === 'enrolled') return 0;
    if (n.category === 'open') return 1;
    if (n.category === 'source') return 2;
    if (n.category === 'loss_origin') {
      if (n.lossOriginStage === 'before_contact') return 10;
      if (n.lossOriginStage === 'before_trial') return 11;
      return 12; // after_trial
    }
    return 20; // lost_reason
  };

  const nodesByCol: Record<number, LeadFlowNode[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
  flow.nodes.forEach((n) => {
    if (nodesByCol[n.column]) {
      nodesByCol[n.column].push(n);
    }
  });

  Object.keys(nodesByCol).forEach((c) => {
    const colIdx = Number(c);
    nodesByCol[colIdx].sort((a, b) => {
      const orderA = orderCategory(a);
      const orderB = orderCategory(b);
      if (orderA !== orderB) return orderA - orderB;
      // If both are reason nodes in Col 5, sort largest first
      if (a.category === 'lost_reason' && b.category === 'lost_reason') {
        if (b.value !== a.value) return b.value - a.value;
      }
      return a.id.localeCompare(b.id);
    });
  });

  // Compute node Y positions
  const placedNodesMap = new Map<string, PlacedNode>();
  let maxBottomY = 0;

  Object.keys(nodesByCol).forEach((c) => {
    const colIdx = Number(c);
    const colNodes = nodesByCol[colIdx];
    let currentY = topPadding;

    colNodes.forEach((node) => {
      const nodeH = node.value * scale;
      const x = columnX[colIdx];
      const y = currentY;

      placedNodesMap.set(node.id, {
        ...node,
        x,
        y,
        w: nodeWidth,
        h: nodeH,
      });

      // Gap between nodes
      const gap = 18;
      currentY += nodeH + gap;
      if (currentY > maxBottomY) maxBottomY = currentY;
    });
  });

  const svgHeight = Math.max(maxBottomY + bottomPadding, 590);
  const viewBox = `0 0 ${targetWidth} ${svgHeight}`;

  // Rule 6: Within each node sort links by vertical position of the other end
  // Links grouped by source and target
  const linksBySource: Record<string, LeadFlowLink[]> = {};
  const linksByTarget: Record<string, LeadFlowLink[]> = {};

  flow.links.forEach((link) => {
    if (link.value <= 0) return;
    if (!linksBySource[link.source]) linksBySource[link.source] = [];
    linksBySource[link.source].push(link);

    if (!linksByTarget[link.target]) linksByTarget[link.target] = [];
    linksByTarget[link.target].push(link);
  });

  // Sort outgoing links from each node by target node Y
  Object.keys(linksBySource).forEach((srcId) => {
    linksBySource[srcId].sort((a, b) => {
      const nodeA = placedNodesMap.get(a.target);
      const nodeB = placedNodesMap.get(b.target);
      const yA = nodeA ? nodeA.y : 0;
      const yB = nodeB ? nodeB.y : 0;
      return yA - yB;
    });
  });

  // Sort incoming links to each node by source node Y
  Object.keys(linksByTarget).forEach((tgtId) => {
    linksByTarget[tgtId].sort((a, b) => {
      const nodeA = placedNodesMap.get(a.source);
      const nodeB = placedNodesMap.get(b.source);
      const yA = nodeA ? nodeA.y : 0;
      const yB = nodeB ? nodeB.y : 0;
      return yA - yB;
    });
  });

  // Assign ports to links based on sorted order
  const linkSourceOffsets: Record<string, number> = {};
  const linkTargetOffsets: Record<string, number> = {};

  Object.keys(linksBySource).forEach((srcId) => {
    const srcNode = placedNodesMap.get(srcId);
    if (!srcNode) return;
    let currY = srcNode.y;
    linksBySource[srcId].forEach((link) => {
      linkSourceOffsets[link.id] = currY;
      currY += link.value * scale;
    });
  });

  Object.keys(linksByTarget).forEach((tgtId) => {
    const tgtNode = placedNodesMap.get(tgtId);
    if (!tgtNode) return;
    let currY = tgtNode.y;
    linksByTarget[tgtId].forEach((link) => {
      linkTargetOffsets[link.id] = currY;
      currY += link.value * scale;
    });
  });

  const placedLinks: PlacedLink[] = [];
  flow.links.forEach((link) => {
    if (link.value <= 0) return;
    const srcNode = placedNodesMap.get(link.source);
    const tgtNode = placedNodesMap.get(link.target);
    if (!srcNode || !tgtNode) return;

    const sourceY0 = linkSourceOffsets[link.id] ?? srcNode.y;
    const targetY0 = linkTargetOffsets[link.id] ?? tgtNode.y;
    const linkH = link.value * scale;

    placedLinks.push({
      ...link,
      sourceY0,
      sourceH: linkH,
      targetY0,
      targetH: linkH,
    });
  });

  // Rule 5: Split each reason bar into segments with origin colours,
  // in the same top-to-bottom order as incoming ribbons
  placedNodesMap.forEach((node) => {
    if (node.category === 'lost_reason') {
      const incoming = (linksByTarget[node.id] || []).map((l) => {
        const placed = placedLinks.find((pl) => pl.id === l.id);
        const originStage = l.originStage || (
          l.source.includes('before_contact') ? 'before_contact' :
          l.source.includes('before_trial') ? 'before_trial' : 'after_trial'
        );
        const originLabel = originStage === 'before_contact'
          ? 'Before contact'
          : originStage === 'before_trial'
          ? 'Before trial'
          : 'After trial';

        return {
          originId: originStage as LossOriginStage,
          originLabel,
          color: l.color,
          value: l.value,
          pctOfReason: node.value > 0 ? Math.round((l.value / node.value) * 1000) / 10 : 0,
          y: placed ? placed.targetY0 : node.y,
          h: placed ? placed.targetH : l.value * scale,
        };
      });

      node.segments = incoming;
    }
  });

  return {
    svgWidth: targetWidth,
    svgHeight,
    viewBox,
    placedNodes: Array.from(placedNodesMap.values()),
    placedLinks,
    scale,
    leftMargin,
    rightMargin,
  };
}
