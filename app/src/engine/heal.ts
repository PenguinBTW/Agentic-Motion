// Directorial Self-Correction Contract (AgentDirectorLoop & agent-heal)
// Maps signals from diagnostic telemetry and the 9 visual instruments
// into machine-actionable repair directives emitted into findings.json.

export type ActionType =
  | 'MUTATE_PROPERTY'
  | 'ADJUST_TIMING'
  | 'ADD_KNOCKOUT_HALO'
  | 'ADJUST_CAMERA'
  | 'STAGGER_ONSET'
  | 'TUNE_CURVE'
  | 'ADJUST_LAYOUT'
  | 'SWAP_PALETTE_TOKEN';

export interface RemediationDirective {
  action: ActionType;
  target_file?: string;
  target_line_hint?: string;
  recommended_patch: string;
  explanation: string;
}

export interface DiagnosticFinding {
  id: string;
  tier: 'A' | 'B' | 'C';
  rule: string;
  target_entity?: string;
  timestamp: number;
  evidence_file?: string;
  metric_value?: number;
  threshold?: number;
  remediation_directive: RemediationDirective;
}

export interface DiagnosticSignal {
  rule: string;
  entityId?: string;
  t: number;
  value?: number;
  threshold?: number;
  context?: Record<string, any>;
}

export class AgentHeal {
  /**
   * Translate raw telemetry violations and instrument metrics into machine-actionable directives
   */
  static analyzeSignal(sig: DiagnosticSignal, index = 1): DiagnosticFinding {
    const findingId = `${sig.rule.toUpperCase()}-${String(index).padStart(3, '0')}`;

    switch (sig.rule) {
      case 'curves':
      case 'arrival_impact': {
        const impact = sig.value ?? 6.2;
        return {
          id: findingId,
          tier: 'A',
          rule: 'arrival_impact_kink',
          target_entity: sig.entityId ?? 'motion_element',
          timestamp: sig.t,
          metric_value: impact,
          threshold: sig.threshold ?? 5.0,
          remediation_directive: {
            action: 'TUNE_CURVE',
            target_line_hint: 'motion.ease or motion.spring',
            recommended_patch: `motion.spring(t0, t, { freq: 2.8, damping: 0.85, v0: 0.0 }) // Smoothed arrival shoulder`,
            explanation: `Element arrives at rest with abrupt $C^0$ velocity impact (${impact.toFixed(1)}% > 5.0%). Tune spring damping >= 0.82 or soften Bezier cubic exit tangent.`,
          },
        };
      }

      case 'legibility':
      case 'contrast': {
        const contrast = sig.value ?? 3.2;
        return {
          id: findingId,
          tier: 'A',
          rule: 'low_contrast_legibility',
          target_entity: sig.entityId ?? 'headline_text',
          timestamp: sig.t,
          metric_value: contrast,
          threshold: sig.threshold ?? 4.5,
          remediation_directive: {
            action: 'ADD_KNOCKOUT_HALO',
            target_line_hint: '.withKnockoutHalo',
            recommended_patch: `.withKnockoutHalo(3.0, rgba('ink', 0.92))`,
            explanation: `Text contrast falls below WCAG AAA threshold (${contrast.toFixed(2)}:1 < 4.5:1). Apply ink knockout under-stroke or inject localized backdrop scrim.`,
          },
        };
      }

      case 'godview':
      case 'near_clip': {
        const dist = sig.value ?? 0.06;
        return {
          id: findingId,
          tier: 'A',
          rule: 'camera_geometry_penetration',
          target_entity: sig.entityId ?? 'main_rig',
          timestamp: sig.t,
          metric_value: dist,
          threshold: sig.threshold ?? 0.10,
          remediation_directive: {
            action: 'ADJUST_CAMERA',
            target_line_hint: 'rig.setPath waypoint',
            recommended_patch: `pos: [pos.x, pos.y, pos.z - 0.5], focalLength: 50 // Retract waypoint along gaze normal`,
            explanation: `Camera penetrates near-clip frustum (${dist.toFixed(2)}m < 0.10m). Retract waypoint 0.5m backwards or lengthen focal length.`,
          },
        };
      }

      case 'rhythm':
      case 'onset_bunching': {
        const count = sig.value ?? 4;
        return {
          id: findingId,
          tier: 'B',
          rule: 'onset_traffic_jam',
          target_entity: sig.entityId ?? 'card_cluster',
          timestamp: sig.t,
          metric_value: count,
          threshold: sig.threshold ?? 3,
          remediation_directive: {
            action: 'STAGGER_ONSET',
            target_line_hint: 'motion.stagger',
            recommended_patch: `const delays = motion.stagger(${count}, 0.35, 'center-out'); // 70ms cascade`,
            explanation: `${count} elements trigger within 20ms window causing perceptual clutter. Disperse arrivals across a 350ms cascade.`,
          },
        };
      }

      case 'saliency':
      case 'hero_attention': {
        const share = sig.value ?? 42;
        return {
          id: findingId,
          tier: 'B',
          rule: 'saliency_distraction',
          target_entity: sig.entityId ?? 'hero_subject',
          timestamp: sig.t,
          metric_value: share,
          threshold: sig.threshold ?? 60,
          remediation_directive: {
            action: 'MUTATE_PROPERTY',
            target_line_hint: 'particles.speed or lines.opacity',
            recommended_patch: `particles.speed = 0.5; lines.opacity = 0.25; // Dim peripheral elements`,
            explanation: `Hero element captures only ${share.toFixed(0)}% visual gaze (target >= 60%). Lower peripheral particle velocity and line luminance.`,
          },
        };
      }

      case 'framing':
      case 'safe_zone': {
        return {
          id: findingId,
          tier: 'A',
          rule: 'mobile_framing_breach',
          target_entity: sig.entityId ?? 'side_callout',
          timestamp: sig.t,
          remediation_directive: {
            action: 'ADJUST_LAYOUT',
            target_line_hint: 'node.pin',
            recommended_patch: `node.pin = 'top-center'; node.margin = { top: 64 }; // Responsive center anchor`,
            explanation: `Element overflows 9:16 vertical safe zone. Pin to top-center with inward margin.`,
          },
        };
      }

      case 'F04':
      case 'collision': {
        return {
          id: findingId,
          tier: 'A',
          rule: 'screen_box_collision',
          target_entity: sig.entityId ?? 'overlapping_text',
          timestamp: sig.t,
          remediation_directive: {
            action: 'ADJUST_LAYOUT',
            target_line_hint: 'y offset / stack',
            recommended_patch: `y: prevY + elementHeight + 24 // Stacking margin clearance`,
            explanation: `Two active typography/card bounding boxes overlap on screen. Increase vertical stacking offset.`,
          },
        };
      }

      case 'F05':
      case 'clipping': {
        return {
          id: findingId,
          tier: 'A',
          rule: 'viewport_boundary_clip',
          target_entity: sig.entityId ?? 'clipped_node',
          timestamp: sig.t,
          remediation_directive: {
            action: 'ADJUST_LAYOUT',
            target_line_hint: 'node.setMargins or clamp screen bounds',
            recommended_patch: `node.setMargins({ left: 64, right: 64 })`,
            explanation: `Element extends past screen border (0 or W/H). Pull responsive margins inward by 64px.`,
          },
        };
      }

      case 'F07':
      case 'persistence': {
        return {
          id: findingId,
          tier: 'B',
          rule: 'excessive_persistence',
          target_entity: sig.entityId ?? 'stale_text',
          timestamp: sig.t,
          remediation_directive: {
            action: 'ADJUST_TIMING',
            target_line_hint: 'exit transition',
            recommended_patch: `const exitAlpha = 1 - ease.inQuad(Math.max(0, (lt - 4.0) / 0.5));`,
            explanation: `Element remains active without motion for > 6s. Add a smooth exit fade or spring dismiss.`,
          },
        };
      }

      case 'F12':
      case 'palette_off_share': {
        return {
          id: findingId,
          tier: 'C',
          rule: 'palette_gamut_deviation',
          timestamp: sig.t,
          remediation_directive: {
            action: 'SWAP_PALETTE_TOKEN',
            target_line_hint: 'fill / stroke color',
            recommended_patch: `fill: [LIN.bone[0], LIN.bone[1], LIN.bone[2], 0.9] // Use brand token`,
            explanation: `Off-brand color detected outside active design tokens. Bind color to LIN token or rgba('accent').`,
          },
        };
      }

      default: {
        return {
          id: findingId,
          tier: 'B',
          rule: sig.rule,
          target_entity: sig.entityId,
          timestamp: sig.t,
          remediation_directive: {
            action: 'MUTATE_PROPERTY',
            recommended_patch: `// Review rule: ${sig.rule}`,
            explanation: `Telemetry rule violation: ${sig.rule} at t = ${sig.t.toFixed(2)}s.`,
          },
        };
      }
    }
  }

  /**
   * Batch process an array of signals into a complete findings array
   */
  static processSignals(signals: DiagnosticSignal[]): DiagnosticFinding[] {
    return signals.map((sig, i) => this.analyzeSignal(sig, i + 1));
  }

  /**
   * Serialize findings to JSON string (compatible with findings.json schema)
   */
  static serialize(findings: DiagnosticFinding[]): string {
    return JSON.stringify({ findings }, null, 2);
  }

  /**
   * Format actionable markdown remediation report for an autonomous coding agent
   */
  static formatMarkdownReport(findings: DiagnosticFinding[]): string {
    if (findings.length === 0) {
      return '### Autonomous Agent Self-Healing: 0 Issues Found\nAll motion, layout, and contrast metrics within nominal bounds.';
    }

    const lines: string[] = [
      `### Autonomous Agent Self-Healing Directive Report (${findings.length} findings)`,
      '',
      '| ID | Tier | Rule | Timestamp | Entity | Recommended Action |',
      '| :--- | :---: | :--- | :---: | :--- | :--- |',
    ];

    for (const f of findings) {
      lines.push(
        `| **${f.id}** | \`${f.tier}\` | ${f.rule} | ${f.timestamp.toFixed(2)}s | \`${f.target_entity ?? 'scene'}\` | \`${f.remediation_directive.action}\` |`
      );
    }

    lines.push('', '#### Actionable Directives:');
    for (const f of findings) {
      lines.push(`##### ${f.id} (${f.rule}) at t=${f.timestamp.toFixed(2)}s`);
      lines.push(`- **Explanation**: ${f.remediation_directive.explanation}`);
      if (f.remediation_directive.target_line_hint) {
        lines.push(`- **Target Hint**: \`${f.remediation_directive.target_line_hint}\``);
      }
      lines.push('```typescript');
      lines.push(f.remediation_directive.recommended_patch);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }
}
