# Instrument 08: Choreography Gantt & Stagger Rhythm Visualizer (`rhythm`)

## 1. Overview & Objective

The **Choreography Gantt & Stagger Rhythm Visualizer** is a multi-track temporal orchestration instrument that maps the timing, pacing, and stagger relationships of all animated scene entities onto a **visual motion Gantt chart**.

It replicates the multi-track timeline view of modern digital audio workstations (DAWs) and video editors, allowing autonomous coding agents and human art directors to inspect ensemble choreography, stagger intervals ($\Delta t$), and rhythm synchronization at a single glance.

---

## 2. The Problem It Solves

Motion graphics is the art of temporal orchestration. A cohesive scene rarely animates just one element; it choreographs an ensemble (camera, hero product, headlines, feature cards, HUD badges, and particle bursts):
1. **Visual Traffic Jams**: When writing procedural code, an autonomous agent often fires all element entrance animations at $t = t_{\text{start}}$ ($\Delta t = 0$). Everything moves at once, overwhelming the viewer's attention and destroying visual hierarchy.
2. **Sluggish Timing Gaps**: Alternatively, the agent spaces elements with excessive delays ($> 500\,\text{ms}$), causing visual momentum to stall between sequential arrivals.
3. **Uneven Stagger Intervals**: Animating $N$ items in a card grid or menu list requires harmonious cascade intervals ($50\text{–}80\,\text{ms}$). Irregular math formulas create awkward, stuttered arrivals.
4. **Desynchronized Audio & Voiceover Cues**: Visual impacts and typographic accents missing sound design transients or voiceover word onsets.

---

## 3. Visual Specifications (`choreography_gantt.png`)

```
CHOREOGRAPHY GANTT TIMELINE SCHEMATIC (choreography_gantt.png)

TRACKS                 t=0s       t=1s       t=2s       t=3s       t=4s
Camera Track          [═══════════════════════════════════════════════════]
Hero Product                     [═════════════════════════════]
Title Headline                   [═══][──────────────────────][═══]
                                   \  Stagger Cascade: Δt = 70ms
Card A                            [═══][─────────────────][═══]
Card B                             [═══][───────────────][═══]
Card C                              [═══][──────────────][═══]
CTA Button                                             [═══][──────────]
                      │          │          │          │          │
Audio SFX Markers     ▼          ▼          ▼          ▼          ▼
                      [Whoosh]   [Beat 1]   [Click]    [Beat 2]   [Impact]

KEY:
[═══] Green Gradient: Entrance Ease-In (Animation in-flight)
[───] Solid Blue: Active Dwell Rest (Readable / Stable Display)
[═══] Orange Gradient: Exit Ease-Out (Dismissal)
  \   Diagonal Connector: Detected Stagger Cascade Line
```

### Visual Features
1. **Vertical Entity Tracks**: Dedicated horizontal track per scene entity (Camera, Hero Mesh, Title, Cards, CTA Button, Particles).
2. **Bar Anatomy**:
   - **Green Shading**: Entrance ease-in duration.
   - **Solid Blue Bar**: Active readable dwell hold.
   - **Orange Shading**: Exit ease-out duration.
   - **Embedded Velocity Sparkline**: Shows internal kinematic speed curve within each bar.
3. **Stagger Cascade Vectors ($\backslash$)**:
   - Diagonal guide lines connecting the start of sequential elements, measuring the cascade slope and interval consistency.
4. **Audio / Event Marker Rulers**:
   - Vertical dotted rules aligned with sound design transients, voiceover word boundaries, or animation triggers.

---

## 4. Technical CLI Interface

```bash
# Inspect ensemble choreography in a dashboard overview sequence
bun scripts/rhythm.ts --scene dashboard_overview --from 0.00 --to 5.00 --out ../out/visual/dashboard_rhythm

# Audit stagger cascade across a product feature grid
bun scripts/rhythm.ts --scene feature_grid --t 3.50 --window 1.5

# Check audio-visual sync alignment across chapter cuts
bun scripts/rhythm.ts --scene hero_reveal --audio-markers ../data/sfx_cues.json
```

### Options
* `--scene <name>`: Target scene or plate identifier.
* `--from <seconds> --to <seconds>`: Inspection time window.
* `--audio-markers <path>`: Optional JSON file containing audio transient or voiceover cue timestamps.
* `--out <path>`: Target directory for PNG Gantt chart and telemetry JSON.

---

## 5. Quantitative Telemetry (`rhythm_summary.json`)

```json
{
  "scene": "dashboard_overview",
  "time_window_s": [0.00, 5.00],
  "total_animated_entities": 7,
  "stagger_sequence_detected": {
    "group": "card_cascade",
    "count": 3,
    "stagger_interval_ms": 70,
    "stagger_regularity_score": 0.98
  },
  "simultaneous_onset_collisions": 0,
  "max_dead_gap_s": 0.12,
  "audio_alignment_offset_ms": 8,
  "status": "tightly_orchestrated"
}
```

---

## 6. Autonomous Agent Iteration Workflow

```
[ Agent parses rhythm_summary.json ]
                │
                ├─► simultaneous_onset_collisions > 0
                │   • Diagnosis: Multiple visual elements start animating on the exact same frame (traffic jam).
                │   • Action: Apply MotionBus.stagger(count, totalDur, 'center-out') to stagger arrivals.
                │
                ├─► max_dead_gap_s > 0.40s
                │   • Diagnosis: Visual momentum stalls between sequential element appearances.
                │   • Action: Tighten the delay between outgoing and incoming elements by 150–200ms.
                │
                └─► audio_alignment_offset_ms > 45ms
                    • Diagnosis: Visual punch misses the sound design transient or voiceover emphasis.
                    • Action: Nudge keyframe start timestamp to snap precisely onto the audio trigger.
```
