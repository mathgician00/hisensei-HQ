import assert from 'node:assert/strict';
import { calculateLeadFlow, computeSankeyLayout, RawLeadForFlow } from '@/lib/leadFlow';
import { tutoringService } from '@/src/services/tutoringService';

async function runLeadFlowUnitTests() {
  console.log('=== LEAD FLOW SANKEY UNIT TESTS (Flow Conservation & Mutual Exclusivity) ===\n');

  // ---------------------------------------------------------
  // Test 1: Real Database Data with all filter channels
  // ---------------------------------------------------------
  console.log('Test 1: Real Database lead_flow validation across channels...');
  for (const channel of ['all', 'instagram', 'referral', 'event', 'other']) {
    const flow = await tutoringService.getLeadFlow(channel);

    // Rule 9: Reconciled with 0 errors
    assert.equal(
      flow.reconciliationErrors.length,
      0,
      `Reconciliation errors for channel ${channel}: ${flow.reconciliationErrors.join('; ')}`
    );
    assert.equal(flow.summary.reconciled, true, `Flow not reconciled for channel ${channel}`);

    // Rule 1: Loss nodes must be mutually exclusive
    const lostBeforeContact = flow.summary.lostBeforeContact;
    const lostBeforeTrial = flow.summary.lostBeforeTrial;
    const lostAfterTrial = flow.summary.lostAfterTrial;
    const totalLost = flow.summary.lost;

    assert.equal(
      lostBeforeContact + lostBeforeTrial + lostAfterTrial,
      totalLost,
      `Loss nodes sum (${lostBeforeContact + lostBeforeTrial + lostAfterTrial}) != total lost (${totalLost}) for channel ${channel}`
    );

    assert.equal(
      flow.summary.enrolled + flow.summary.open + totalLost,
      flow.totalLeads,
      `Enrolled + Open + Loss nodes != total leads for channel ${channel}`
    );

    // Rule 3: Never draw a node or label for a value of 0
    flow.nodes.forEach((node) => {
      assert.ok(node.value > 0, `Node ${node.id} has value ${node.value} <= 0! Zero-value nodes must not exist.`);
    });
    flow.links.forEach((link) => {
      assert.ok(link.value > 0, `Link ${link.id} has value ${link.value} <= 0! Zero-value links must not exist.`);
    });

    // Rule 10: Flow conservation per node
    // sum(incoming) = value = sum(outgoing) for intermediate nodes
    const nodeInflow: Record<string, number> = {};
    const nodeOutflow: Record<string, number> = {};
    flow.links.forEach((link) => {
      nodeOutflow[link.source] = (nodeOutflow[link.source] || 0) + link.value;
      nodeInflow[link.target] = (nodeInflow[link.target] || 0) + link.value;
    });

    flow.nodes.forEach((node) => {
      const incoming = nodeInflow[node.id] || 0;
      const outgoing = nodeOutflow[node.id] || 0;

      if (node.column === 0) {
        // Source node: outgoing must equal node value
        assert.equal(
          outgoing,
          node.value,
          `Source node ${node.id} outgoing (${outgoing}) != value (${node.value})`
        );
      } else if (node.column === 5) {
        // Terminal node: incoming must equal node value
        assert.equal(
          incoming,
          node.value,
          `Terminal node ${node.id} incoming (${incoming}) != value (${node.value})`
        );
      } else {
        // Intermediate nodes: incoming == value AND outgoing == value
        assert.equal(
          incoming,
          node.value,
          `Intermediate node ${node.id} (${node.label}) incoming (${incoming}) != value (${node.value})`
        );
        assert.equal(
          outgoing,
          node.value,
          `Intermediate node ${node.id} (${node.label}) outgoing (${outgoing}) != value (${node.value})`
        );
      }
    });

    // Layout validation
    const layout = computeSankeyLayout(flow, 1460);
    assert.ok(layout.rightMargin >= 260, `Right margin (${layout.rightMargin}) must be >= 260px`);
    assert.ok(layout.svgHeight > 0, 'Invalid SVG height');

    // Rule 3 in layout: No placed node or link has value <= 0
    layout.placedNodes.forEach((node) => {
      assert.ok(node.value > 0, `Placed node ${node.id} has value <= 0`);
      assert.ok(node.h > 0, `Placed node ${node.id} has height <= 0`);
      assert.ok(!Number.isNaN(node.x) && !Number.isNaN(node.y), `Node ${node.id} has NaN coordinates`);
    });

    layout.placedLinks.forEach((link) => {
      assert.ok(link.value > 0, `Placed link ${link.id} has value <= 0`);
      assert.ok(link.sourceH > 0 && link.targetH > 0, `Placed link ${link.id} has invalid height`);
      assert.ok(!Number.isNaN(link.sourceY0) && !Number.isNaN(link.targetY0), `Link ${link.id} has NaN coordinates`);
    });

    // Rule 5: Check reason bar segments
    layout.placedNodes.filter((n) => n.category === 'lost_reason').forEach((reasonNode) => {
      assert.ok(reasonNode.segments && reasonNode.segments.length > 0, `Reason node ${reasonNode.id} must have segments`);
      const segSum = reasonNode.segments!.reduce((acc, s) => acc + s.value, 0);
      assert.equal(segSum, reasonNode.value, `Reason node ${reasonNode.id} segments sum (${segSum}) != node value (${reasonNode.value})`);
    });

    console.log(`  ✓ Channel "${channel}": ${flow.totalLeads} leads validated with exact flow conservation.`);
  }

  // ---------------------------------------------------------
  // Test 2: Acceptance Check on 'all' leads
  // ---------------------------------------------------------
  console.log('\nTest 2: Acceptance Criteria Verification on full database dataset...');
  const fullFlow = await tutoringService.getLeadFlow('all');
  assert.equal(fullFlow.totalLeads, 62, 'Total leads must be 62');
  assert.equal(fullFlow.summary.enrolled, 24, 'Enrolled leads must be 24');
  assert.equal(fullFlow.summary.open, 0, 'Open leads must be 0');
  assert.equal(fullFlow.summary.lostBeforeContact, 6, 'Lost: Before contact must be 6');
  assert.equal(fullFlow.summary.lostBeforeTrial, 16, 'Lost: Before trial must be 16');
  assert.equal(fullFlow.summary.lostAfterTrial, 16, 'Lost: After trial must be 16');
  assert.equal(fullFlow.summary.lost, 38, 'Total lost leads must be 38 (6 + 16 + 16)');

  // Rule 9: Exact footer check
  const expectedFooter = '24 enrolled + 0 open + 6 + 16 + 16 lost = 62 ✓';
  assert.equal(fullFlow.summary.footerText, expectedFooter, `Footer must be "${expectedFooter}"`);
  console.log(`  ✓ Acceptance Verified: Footer text is "${fullFlow.summary.footerText}"`);

  // Rule 2 check: Reasons must not start directly from Trial Attended or Contacted
  fullFlow.links.forEach((l) => {
    if (l.target.startsWith('node_reason_')) {
      assert.ok(
        l.source === 'node_lost_before_contact' ||
        l.source === 'node_lost_before_trial' ||
        l.source === 'node_lost_after_trial',
        `Reason link ${l.id} originates from ${l.source}, but must originate ONLY from the 3 loss nodes!`
      );
    }
  });
  console.log('  ✓ Acceptance Verified: All reason links originate exclusively from the 3 loss nodes.');

  // ---------------------------------------------------------
  // Test 3: Synthetic Dataset with Active In-Flight Leads & Drops
  // ---------------------------------------------------------
  console.log('\nTest 3: Synthetic Dataset (active open leads, mixed drop-offs)...');
  const syntheticLeads: RawLeadForFlow[] = [
    // 3 Open before contact (stage: 'new')
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `syn-new-${i}`,
      code: `S-NEW-${i}`,
      name: `Syn New ${i}`,
      source_channel: 'instagram',
      current_stage: 'new',
      lost_reason: null,
      was_contacted: false,
    })),
    // 4 Lost before contact
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `syn-lost-bc-${i}`,
      code: `S-LBC-${i}`,
      name: `Syn Lost BC ${i}`,
      source_channel: 'referral',
      current_stage: 'lost',
      lost_reason: 'no response',
      was_contacted: false,
    })),
    // 5 Open before trial (stage: 'trial_booked')
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `syn-open-bt-${i}`,
      code: `S-OBT-${i}`,
      name: `Syn Open BT ${i}`,
      source_channel: 'event',
      current_stage: 'trial_booked',
      lost_reason: null,
      was_contacted: true,
      was_booked: true,
      was_attended: false,
    })),
    // 6 Lost before trial (3 price, 3 trial no-show)
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `syn-lost-bt-price-${i}`,
      code: `S-LBT-P-${i}`,
      name: `Syn Lost BT Price ${i}`,
      source_channel: 'instagram',
      current_stage: 'lost',
      lost_reason: 'price',
      was_contacted: true,
      was_booked: true,
      was_attended: false,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `syn-lost-bt-noshow-${i}`,
      code: `S-LBT-NS-${i}`,
      name: `Syn Lost BT NoShow ${i}`,
      source_channel: 'referral',
      current_stage: 'lost',
      lost_reason: 'trial no-show',
      was_contacted: true,
      was_booked: true,
      was_attended: false,
    })),
    // 7 Attended Trial and Converted to Student
    ...Array.from({ length: 7 }, (_, i) => ({
      id: `syn-conv-${i}`,
      code: `S-CONV-${i}`,
      name: `Syn Conv ${i}`,
      source_channel: 'event',
      current_stage: 'converted',
      lost_reason: null,
      was_contacted: true,
      was_booked: true,
      was_attended: true,
      was_converted: true,
    })),
    // 2 Open after trial (evaluating offer)
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `syn-open-at-${i}`,
      code: `S-OAT-${i}`,
      name: `Syn Open AT ${i}`,
      source_channel: 'referral',
      current_stage: 'offer_made',
      lost_reason: null,
      was_contacted: true,
      was_booked: true,
      was_attended: true,
      was_offered: true,
    })),
    // 5 Lost after trial (3 budget, 2 schedule conflict)
    ...Array.from({ length: 3 }, (_, i) => ({
      id: `syn-lost-at-budget-${i}`,
      code: `S-LAT-B-${i}`,
      name: `Syn Lost AT Budget ${i}`,
      source_channel: 'instagram',
      current_stage: 'lost',
      lost_reason: 'budget',
      was_contacted: true,
      was_booked: true,
      was_attended: true,
      was_offered: true,
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `syn-lost-at-sched-${i}`,
      code: `S-LAT-S-${i}`,
      name: `Syn Lost AT Sched ${i}`,
      source_channel: 'event',
      current_stage: 'lost',
      lost_reason: 'schedule conflict',
      was_contacted: true,
      was_booked: true,
      was_attended: true,
      was_offered: false,
    })),
  ];

  const totalSyn = syntheticLeads.length; // 3 + 4 + 5 + 6 + 7 + 2 + 5 = 32
  assert.equal(totalSyn, 32);

  const synFlow = calculateLeadFlow(syntheticLeads);
  assert.equal(synFlow.totalLeads, 32);
  assert.equal(synFlow.reconciliationErrors.length, 0);
  assert.equal(synFlow.summary.reconciled, true);
  assert.equal(synFlow.summary.enrolled, 7);
  assert.equal(synFlow.summary.open, 10); // 3 + 5 + 2 = 10
  assert.equal(synFlow.summary.lostBeforeContact, 4);
  assert.equal(synFlow.summary.lostBeforeTrial, 6);
  assert.equal(synFlow.summary.lostAfterTrial, 5);
  assert.equal(synFlow.summary.lost, 15);
  assert.equal(synFlow.summary.footerText, '7 enrolled + 10 open + 4 + 6 + 5 lost = 32 ✓');

  // Verify node conservation in synthetic
  const synLayout = computeSankeyLayout(synFlow, 1460);
  assert.ok(synLayout.placedNodes.length > 0);
  console.log(`  ✓ Synthetic dataset (${totalSyn} leads, ${synFlow.summary.open} open, ${synFlow.summary.lost} lost, ${synFlow.summary.enrolled} enrolled) verified with 0 errors.`);

  // ---------------------------------------------------------
  // Test 4: Empty Dataset (0 leads)
  // ---------------------------------------------------------
  console.log('\nTest 4: Empty Dataset (0 leads)...');
  const emptyFlow = calculateLeadFlow([]);
  assert.equal(emptyFlow.totalLeads, 0);
  assert.equal(emptyFlow.reconciliationErrors.length, 0);
  assert.equal(emptyFlow.summary.reconciled, true);
  assert.equal(emptyFlow.nodes.length, 0);
  const emptyLayout = computeSankeyLayout(emptyFlow, 1460);
  assert.equal(emptyLayout.placedNodes.length, 0);
  console.log('  ✓ Empty dataset handled gracefully with 0 errors.');

  console.log('\n=== ALL LEAD FLOW UNIT TESTS PASSED SUCCESSFULLY! ===\n');
}

runLeadFlowUnitTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Failed:', err);
    process.exit(1);
  });
