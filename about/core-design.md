---
description: Functionality.
---

# Core Design

The first key concept to analyze is **Energy**.

We want it to be present in every aspect of gameplay, something that keeps players alert and fully engaged. In this sense, we aim for most heroes to have **close-range combat styles**, pushing players out of the comfort zone of “poker-style” characters that safely melt enemies from a distance.

Let’s be honest: the common excuse of _“they have range and damage, but they’re fragile if you reach them”_ is comfortable, and it oversimplifies gameplay balance. Fragile characters aren’t always isolated targets; in a well-structured team composition, they’ll have support and frontliners making them nearly untouchable.

This doesn’t mean ranged or fragile heroes shouldn’t exist. It simply exposes the **false sense of complexity** that often surrounds them. Team fights where the distance between combatants is reduced tend to be far more **energetic and intense**, removing the occasional monotony and adding a spark of emotion to every match — for both sides.

That is the **core philosophy behind Ego Quantum’s combat design**.

### Roles & Archetypes

In _Ego Quantum_, heroes are divided into **three simple roles**: **Tank**, **DPS**, and **Support**.

Each role is designed to behave **according to its function** — no blurring of boundaries or confused identities.

As an unfortunate former _League of Legends_ player, I’ve witnessed countless cases where the opposite happens, tanks out-damaging carries, supports one-shotting enemies, or DPS characters being nearly indestructible.

### Tanks

**Tanks** will be exactly what their name suggests, shields of flesh and steel. Their purpose is to be **resilient, large, and equipped with crowd control abilities**, never becoming **predators of their own predators (the DPS)**. Their items **do not scale for damage**; instead, they grant resistances, health, regeneration effects, and shields, everything that keeps them **alive**, not terrifying.

Tanks are the **frontline of the team**: they protect, enable their carries to thrive in lane, and hold the line when the game turns rough. That’s their duty — and that’s enough.

### Tanks Design & Math

**Tanks** are frontline protectors whose primary impact comes from **survivability, space control, and disruption**, not raw damage. Their kit emphasizes initiation, peel, and objective presence.

#### Core Goals

1. **Clarity of Function:** Tanks survive and control; they do not scale into high damage.
2. **Counterplay:** Survive long enough to enable allies, but with constrained damage troughtput.
3. **Readable Scaling:** Defensive stats scale predictably with diminishing returns; offensive output remains capped.

***

#### Base Variables

* `HP` → Health Points
* `AR` → Armor (physical defense)
* `MR` → Ether (magical defense)
* `RR` → Flat damage reduction (0-1), applied after armor/ether (rare; usually item-gated)
* `LVL` → Hero Level
* `D_base` → Base weapon/ability damage per second (DPS) before mitigation
* `CCp` → Crowd control potency (seconds of hard CC)
* `MS` → Movement speed (units/s)
* `HPR` → Health regeneration per second
* `θ` → Damage redirection fraction (Guard/Taunt mechanics), 0-1
* `ε` → Anti-burst reserve (temporaty HP or shield as a fraction of `HP`)
* Constants tuned by balance:
  * `K_AR`, `K_MR` → Armor/ether base constants
  * `β_HP`, `β_AR`, `β_MR` → Per-level growth factors
  * `α_DPS` → Tank DPS cap as fraction of a true DPS hero (e.g., `α_DPS = 0.35`)
  * `γ_DRcap` → Hard cap on total mitigation (e.g., 0.70–0.75)

***

#### Survivability Model

**1) Mitigation Curves (diminishing returns)**

Use hyperbolic DR to keep additions meaningful but bounded:

* Physical DR: `DR_phys = AR / (AR + K_AR)`
* Ether DR: `DR_mag = MR / (MR + K_MR)`

Recommended starting constants:

* `K_AR = 100`, `K_MR = 100` (tune per TTK targets)

Apply a global mitigation cap:

* `DR_total = 1 − (1 − DR_type) × (1 − RR)`
* **Clamp:** `DR_total ≤ γ_DRcap` (e.g., `γ_DRcap = 0.75`)

> Rationale: tanks can stack defense but never become effectively unkillable.

**2) Effective Health (EHP)**

* `EHP_phys = HP / (1 − DR_phys)`
* `EHP_mag = HP / (1 − DR_mag)`
* If `RR` is present: replace `DR_type` with `DR_total`

Use EHP to target desired **time-to-kill (TTK)** at key levels (e.g., 4/8/12). Balance by adjusting `K_*` and item values to hit TTK windows in coordinated and uncoordinated fights.

**3) Per-Level Growth (defense-weighted)**

* `HP(LVL) = HP_0 + β_HP × LVL`
* `AR(LVL) = AR_0 + β_AR × LVL`
* `MR(LVL) = MR_0 + β_MR × LVL`

Guideline: `β_HP` > `β_AR` ≈ `β_MR` to favor **health-first** scaling; this reduces “all-in” mitigation stacking.

***

#### Offensive Constraint

**1) Hard DPS Cap**

Let `DPS_tank_raw` be the sum of all tank offensive components (basic + kit procs) before mitigation. Enforce:

* `DPS_tank_raw ≤ α_DPS × DPS_dedicated_carry_baseline`
* Suggested: `α_DPS = 0.30–0.40` (start at `0.35`)

This ensures tanks never encroach on the DPS role even when fully built.

**2) Conditional Damage Only**

If any tank item grants damage, it must be **conditional** and **capped**:

* Example (thorns-style): `D_thorns = min(δ × D_incoming_after_DR, D_cap)`
  * `δ` small (e.g., `0.10–0.20`)
  * `D_cap` per second to prevent runaway feedback in 5v5 focus fire.
* No %max-HP offensive procs on tanks, unless strictly **execute-range only** with a **shared internal cooldown**.

**3) Ability Ratios**

* Prefer **flat** or **HP-gated** utility scaling rather than AP/AD.
* If tying to `HP`, make it **non-offensive** (e.g., shield value, zone size) or **soft-offensive** (small DoT with strict cap):
  * `DoT_tank ≤ 0.01 × TargetMaxHP per second`, capped and not stackable with itself.

***

#### Control & Space (Non-Damage Power)

**1) CC Budget (per 10s combat window)**

* Define a per-hero budget: `CC_budget_10s = CCp_stuns + CCp_roots + CCp_silences + …`
* Tanks get the **highest CC\_budget**, but each effect has:
  * **DR on repeat application** to the same target in 10 s:\
    `CC_effective = CC_base × λ^n` with `λ = 0.6–0.8`, `n` = stacks on the same target.
  * **Minimum counterplay window** between hard CCs on the same target (e.g., 0.75s).

**2) Displacement & Zoning**

* Displacements (knockups/knockbacks) are **short** but reliable.
* Zoning fields scale with **duration/area**, not damage.

***

#### Guard/Taunt Mechanics (If Present)

**1) Guard (damage reduction)**

* Redirect a fraction of allied damage to the tank:
  * `D_redirected = θ × D_ally_incoming`
  * Apply after ally’s own DR, before tank DR.
  * Clamp: `θ ≤ 0.35` and cap redirected DPS to maintain TTK.

**2) Taunt**

* For `t_taunt` seconds, forced targeting:
  * Apply **diminishing returns** on repeated taunts to the same target within 10s.
  * Taunt does **not** grant bonus damage; its power budget is **control**.

***

#### Mobility & Access

* Tanks gain **reliable access** (gap-closers) with **low damage** attached.
* `MS` bonuses are **short** and **telegraphed**.
* Mobility scales with **cooldown** and **hero level**, not damage/resistances.

***

#### Itemization Rules for Tanks

1. **Primary:** Health, Armor, Ether, HPR, shields, CC uptime, cleanse tools.
2. **Secondary:** Small conditional damage (thorns/retaliation), strictly capped and never %max-HP spammable.
3. **No pseudo-carry items:** Avoid items that multiply offense via defense (e.g., “gain AD equal to %HP/%maxHP”). If included for hybrids, mark them **not purchasable** by pure Tank class.

{% hint style="info" %}
The mechanic of prohibiting the purchase of items by role are still being studied and may be removed.
{% endhint %}

**Item stat math example:**

* A defensive item might grant: `+HP_i`, `+AR_i`, `+MR_i`, and a **guard aura**:
  * `θ_item = 0.12` to nearby allies
  * Aura has an **ally cap** and **tick-based processing** to avoid burst abuse.

***

#### Sanity Checks (Balance Targets)

* **TTK windows:** At LVL 8 with 2 core tank items, focus-fire TTK should be within `6–15s` versus a coordinated enemy backline; `3.2–5s` if caught alone without cooldowns.
* **Damage parity:** In a 20-second even fight, `TotalDamage_tank ≤ 0.5 × TotalDamage_true_DPS` (teamfight aggregate).
* **Objective pressure:** Tank contributes via **secure space** (time on zone, CC uptime), not via boss-shredding damage.

***

#### Example Numbers (illustrative)

* `HP_0 = 850`, `β_HP = 125`
* `AR_0 = 28`, `β_AR = 4.0`
* `MR_0 = 28`, `β_MR = 4.0`
* `K_AR = 100`, `K_MR = 100`
* `γ_DRcap = 0.75`
* `α_DPS = 0.35`
* `θ` (kit guard) `= 0.15` (capped per ally), `ε = 0.20` (short-duration shield on engage)

These hit readable EHP gains without letting mitigation or conditional damage run away.

{% hint style="success" %}
**Designer Notes**

* Tune `K_AR`, `K_MR` to hit desired TTK across MMR bands.
* Reserve all offensive growth for **DPS** and **burst mages**; tanks trade damage for control and access.
* When a tank build tops damage charts in logs, check: `α_DPS` violations, missing caps on conditional damage, or unintended scaling chains (defense → offense multipliers).
{% endhint %}

***

### DPS

These are the ones responsible for having the **highest bars on the damage charts** across both teams — and that’s obvious. Their role is _Damage Per Second_, self-explanatory. They ensure that enemies are eliminated with **precision, speed, and consistency**.

They may possess **high mobility** and the ability to be **self-sufficient** if caught alone (depending on the player’s skill). However, all of this comes with a trade-off: **they lack high resistances or large health pools**.

This is part of a **logical and necessary balance** — in a team-based game, no single hero should possess every attribute. Protagonism shouldn’t belong to one person, but to the **team as a whole**.

DPS heroes benefit greatly from **strong early phases**, where they can secure advantages over opponents and create the famous _snowball effect_.

They are **powerful, but not untouchable**, and their purpose is simple and absolute: **to deal damage**.

Remember: **Tanks don’t hunt DPS, and DPS obliterate Tanks — or anyone who dares to stand in their way.**

### DPS Design & Math

**DPS** heroes convert resources (positioning, uptime, items) into **reliable damage throughput**. They win fights by sequencing bursts and sustained fire while staying fragile.

#### Core Goals

1. **Highest damage ceiling** under strict survivability constraints.
2. **Skill expression via uptime** (positioning, cooldown weaving, target selection).
3. **Legible scaling:** crit and penetration feel strong but are bounded; true damage exists but is tightly budgeted.

***

#### Base Variables

* `AD`: Physical power (basic attacks/some abilities)
* `AP`: Ether power (spell damage/some abilities)
* `AS`: Attacks per second (after item & kit multipliers)
* `C`: Critical strike chance (0–1)
* `M`: Critical damage multiplier (e.g., `1.75` = +75%)
* `Ppen`: Percent penetration vs. armor/ether (0–1), applied first
* `Fpen`: Flat penetration (non-negative), applied second
* `AR`, `MR`: Target’s Armor and Ether
* `K_AR`, `K_MR`: Balance constants for mitigation curves (same family values as Tanks section)
* `τ`: True damage fraction (0–1) of a given hit (ignores defenses)
* `σ`: Damage block/guard fraction on target (post-mitigation block, if any; default 0)
* **Timing & rotation**
  * `Δt`: Combat window (seconds) for evaluation (e.g., 10 s)
  * `CD_i`: Cooldown of ability `i`
  * `U`: Uptime fraction on target within `Δt` (0–1)
* **Fragility guardrails**
  * `EHP_DPS`: Effective health of DPS (should remain the lowest among roles)

***

#### Mitigation & Penetration (for non-true damage)

Use the same diminishing-returns mitigation as Tanks to keep systems unified:

* Raw DR curves:
  * `DR_phys = AR / (AR + K_AR)`
  * `DR_mag = MR / (MR + K_MR)`
* Apply penetration in order (per hit or per ability resolution):
  * `AR' = max(0, (1 − Ppen) × AR − Fpen)`
  * `MR' = max(0, (1 − Ppen) × MR − Fpen)`
  * Then recompute:
    * `DR_phys' = AR' / (AR' + K_AR)`
    * `DR_mag' = MR' / (MR' + K_MR)`
* Post-mitigation block/guard (if target has any):
  * `D_final = (1 − σ) × D_after_DR`

> Design note: cap `Ppen` per source and globally (e.g., `Ppen_total ≤ 0.45`) to prevent nullifying defenses.

***

#### Critical System

**Expected Damage per Basic Attack**

Let `H_base` be the pre-mitigation base hit (from `AD` and on-hit effects).

<table data-header-hidden><thead><tr><th width="218"></th><th></th></tr></thead><tbody><tr><td><strong>Expected crit multiplier</strong></td><td><code>E[crit_mult] = (1 − C) × 1 + C × M = 1 + C × (M − 1)</code></td></tr><tr><td><strong>Expected pre-mitigation hit</strong></td><td><code>E[H_raw] = H_base × E[crit_mult]</code></td></tr><tr><td><strong>Split true vs non-true portions (per hit)</strong></td><td><code>H_true = τ × E[H_raw]</code><br><code>H_nontrue = (1 − τ) × E[H_raw]</code></td></tr><tr><td><strong>Apply mitigation to</strong> <code>H_nontrue</code> <strong>using</strong> <code>DR_phys'</code> <strong>or</strong> <code>DR_mag'</code> <strong>(damage type)</strong></td><td><code>H_mitig = (1 − DR_type') × H_nontrue</code></td></tr><tr><td><strong>Apply any post-mitigation block/guard</strong></td><td><code>H_final = (1 − σ) × (H_true + H_mitig)</code></td></tr></tbody></table>

**Expected Sustained DPS (Basics Only)**

`DPS_basics = AS × H_final × U`

> `U` captures repositioning, kiting, reloads/charge time, animation locks.

***

#### Ability Damage (Burst + DoT)

For each ability `i` with base damage `A_i` (pre-mitigation) and damage type:

1. **Crit behavior:** if ability can crit, multiply `A_i` by `E[crit_mult]`; otherwise leave as is.
2. **True fraction:** split by `τ_i` if the ability contains partial true damage.
3. **Mitigation:** apply `DR_phys'` or `DR_mag'` to the non-true portion, then block/guard `σ`.
4. **Casts per window:** `casts_i(Δt) = floor(Δt / CD_i)` (or use fractional expected casts for long windows)
5. **Total contribution in window:** `D_i(Δt) = casts_i(Δt) × (1 − σ) × [ τ_i × A_i' + (1 − τ_i) × (1 − DR_type') × A_i' ]` where `A_i'` already includes crit if applicable.

**Rotation DPS (Abilities Only):** `DPS_abilities = ( Σ_i D_i(Δt) ) / Δt`

***

#### Total DPS

`DPS_total = DPS_basics + DPS_abilities`

Optional granularity (if you model reloads/heat):

* Replace `U` with a **piecewise uptime model** or a **Markov uptime estimator** for weapons with magazines/overheats.

***

#### True (Pure) Damage Policy

* True damage is **a budgeted resource**: set a small `τ` on specific windows or tie `τ_i` to skill-checks (headshots, weak points, precise timings).
* Avoid sustained `%MaxHP true damage`. If you use `MaxHP` scaling, gate it behind:
  * **Execute thresholds** (e.g., only when target HP ≤ `x%`), and
  * **Internal cooldowns** (e.g., `≥ 8 s`), and
  * **Team-shared cooldowns** if multiple heroes can bring executes.

> Example cap: across all sources, **sustained true damage share** over a 10s window should be `≤ 20–25%` of `DPS_total` on average.

***

#### Crit Stacking Guardrails

* **Caps:**
  * `C ≤ C_cap` (e.g., `0.60`)
  * `M ≤ M_cap` (e.g., `2.00`, i.e., +100%)
* **Diminishing returns** for stacking multiple crit sources (simple continuous DR):\
  `C_eff = C_raw / (1 + λ_C × C_raw)` with `λ_C ≈ 0.75`\
  `M_eff = 1 + (M_raw − 1) / (1 + λ_M × (M_raw − 1))` with `λ_M ≈ 0.6`

Use `C_eff` and `M_eff` in `E[crit_mult]`.

***

#### Penetration Guardrails

* **Order:** `%` first, then flat.
* **Upper bound:** `Ppen_total ≤ 0.45`; `Fpen_total` tuned so that high-pen builds **improve TTK** vs. armored targets but aren’t universally best versus low-defense targets.
* For hybrid damage kits, compute mitigation per component (phys/mag) with their own `Ppen/Fpen`.

***

#### Fragility Requirements (to prove role identity)

* Keep **DPS EHP** the lowest among roles at equivalent item budgets:\
  `EHP_DPS ≤ 0.65 × EHP_Tank` at midgame reference (e.g., LVL 8, 2 items).
* No defensive item should convert defense directly into offense for DPS (no “gain damage from %HP/Armor/Ether”).

***

#### Sanity Checks (Starting Points)

* **Single-target TTK vs. midgame tank (2 core items):**
  * Skilled DPS with pen build and high `U`: `5.0–10.0 s`
  * Low uptime or wrong damage type vs. target build: `6.5–15.7 s`
* **Burst window (Δt = 2 s) vs. squishy:** DPS can secure lethal if **two** of: crit spike, ability connect, weak-point hit.
* **Sustained share:** Over `Δt = 10 s`, `DPS_total` should exceed any non-DPS role by **≥ 35%** in neutral scenarios.

***

#### Example Numbers (illustrative)

Setup: `AD = 110`, `AS = 1.6`, `C_raw = 0.50`, `M_raw = 1.90`, `Ppen = 0.30`, `Fpen = 18`, `τ = 0.10`

Target tank: `AR = 180`, `K_AR = 100`, `σ = 0.05`, `U = 0.75`

1. Crit DR:\
   `C_eff = 0.50 / (1 + 0.75 × 0.50) = 0.50 / 1.375 ≈ 0.3636`\
   `M_eff = 1 + (0.90) / (1 + 0.6 × 0.90) = 1 + 0.90 / 1.54 ≈ 1.584`\
   `E[crit_mult] = 1 + 0.3636 × (1.584 − 1) ≈ 1 + 0.3636 × 0.584 ≈ 1.2125`
2. **Base hit (simplified):**\
   Assume `H_base = AD = 110` → `E[H_raw] = 110 × 1.2125 ≈ 133.4`
3. **Pen & DR:**\
   `AR' = max(0, (1 − 0.30) × 180 − 18) = max(0, 126 − 18) = 108`\
   `DR_phys' = 108 / (108 + 100) ≈ 0.519`
4. **True vs non-true split; block:**\
   `H_true = 0.10 × 133.4 = 13.34`\
   `H_nontrue = 0.90 × 133.4 = 120.06`\
   `H_mitig = (1 − 0.519) × 120.06 ≈ 57.6`\
   `H_final = (1 − 0.05) × (13.34 + 57.6) ≈ 0.95 × 70.94 ≈ 67.4`
5. **Sustained basics:**\
   `DPS_basics = AS × H_final × U = 1.6 × 67.4 × 0.75 ≈ 80.9`

(Then add abilities via the rotation method to get `DPS_total`.)

{% hint style="success" %}
**Designer Notes**

* Tune `K_AR`, `K_MR`, `C_cap`, `M_cap`, `Ppen/Fpen` to hit TTK targets across skill bands.
* Keep **true damage** impactful but **temporal** (windows, executes, weak-points), not passive always-on throughput.
* If DPS are routinely losing to tanks in damage logs, check: penetration caps too low, `U` suppression too harsh (maps/visual clutter), or overtuned guard/block (`σ`) on targets.
{% endhint %}

***

### Support

These heroes are responsible for **keeping their team standing** during difficult fights — through healing, buffs, or even by becoming an additional shield in front of their DPS. Supports can take many forms: **mages**, **light tanks**, or even **damage-capable hybrids** comparable to the team’s carries. However, what truly defines them is their **Utility**.

Their items are the **most versatile in the game**, allowing them to adapt to countless situations and respond to whatever the battle demands. A good Support anticipates danger, strengthens allies, and ensures the team’s survival, often being the difference between defeat and victory.

### Support Design & Math

**Supports** keep allies alive and effective through **healing, shielding, buffs, cleanses, and control**. Their power budget is **utility-first**, with tightly limited personal damage.

#### Core Goals

1. **Utility over damage:** throughput = healing + shielding + mitigation + ally amplification.
2. **Readable scaling:** diminishing returns on stackable sustain/DR; caps on damage amplification.
3. **Counterplay:** anti-heal, shield breakpoints, cooldown windows, positional play.

***

#### Base Variables

* Incoming damage to an ally per hit: `D_in`
* Ally defenses: `AR_t`, `MR_t` (target), with constants `K_AR`, `K_MR`
* Post-pen mitigation on target (same model as other roles):\
  `DR_phys = AR_t / (AR_t + K_AR)`, `DR_mag = MR_t / (MR_t + K_MR)`
* Post-mitigation, pre-shield damage on target:\
  `D_post = (1 − DR_type) × D_in`
* **Healing & Shields**
  * `H_i`: base heal of ability/item `i` (pre-modifiers)
  * `S_i`: base shield of ability/item `i` (pre-modifiers)
  * `η`: anti-heal multiplier on target (0–1), applied to healing only
  * `ξ`: shield break efficiency of enemies vs. shields (0–1) (optional, default 0)
  * `κ_S`: shield decay per second (0–1/s) if decays over time
* Buffs / Amplifiers
  * `A_dmg`: ally outgoing damage amp (multiplier, e.g., 0.15 = +15%)
  * `A_DR`: ally incoming damage reduction (pre- or post-mitigation flag)
  * `A_haste`: attacks-per-second or cast-speed modifier
* **Economy & Timings**
  * Evaluation window: `Δt` (e.g., 10 s)
  * Casts in window: `casts_i(Δt) = floor(Δt / CD_i)` (or fractional expectation)

***

#### Ordering: Damage, Shields, Healing

We standardize resolution for clarity and balance:

1. Apply target mitigation → `D_post`
2. Apply **shields** → `D_to_HP = max(0, D_post − S_active × (1 − ξ))`
3. Apply **healing** to HP (after damage) with anti-heal → `H_eff = η × H_gross`

> Design note: shields protect **post-mitigation** damage (cleaner tuning vs. EHP explosions). Anti-heal (`η`) never affects shields.

***

#### Shields

**Per-Cast Effective Shield**

* If a shield decays or is partially shredded:\
  `S_eff = (1 − ξ) × S_i × (1 − e^{−κ_S × dur_i})`\
  (Use `κ_S = 0` for non-decay; `dur_i` is max duration.)

**Shield EHP Contribution (vs. damage type)**

* Since shields face post-mitigation damage, their EHP is **just** `S_eff` in that context.
* For _planning_, you can express _virtual_ EHP vs. raw damage as:\
  `S_vEHP = S_eff / (1 − DR_type)`

**Shield Throughtput in Window**

`S_total(Δt) = Σ_i [ casts_i(Δt) × S_eff_i ]`

***

#### Healing

**Per-Cast Effective Heal**

`H_eff_i = η × H_i × m_targets × m_AoE`

* `m_targets`: number of valid targets actually hit (≤ max targets)
* `m_AoE`: AoE falloff scalar (0–1), if any

**Healing Throughtput in Window**

`H_total(Δt) = Σ_i [ casts_i(Δt) × H_eff_i ]`

**Healing Per Second (HPS)**

`HPS = H_total(Δt) / Δt`

***

#### Resource Constraint (Sustainable Throughtput)

Across `Δt`, require:\
`Σ_i [ casts_i(Δt) × Cost_i ] ≤ R_0 + RPS × Δt`

If resource-limited, cap casts to:\
`casts_i^*(Δt) = min( casts_i(Δt), floor( (R_0 + RPS × Δt − Σ_{j<i} casts_j^* × Cost_j) / Cost_i ) )`

Compute `H_total^*`, `S_total^*` with constrained casts for **sustainable** numbers.

***

#### Damage Reduction & Amplification

**Incoming DR Aura (ally side)**

Model as **post-mitigation, pre-shield** or **post-shield** depending on design. Recommended: **post-mitigation, pre-shield** so DR meaningfully preserves shields.

* If DR aura is `A_DR` (0–0.30 typical), then effective post step becomes:\
  `D_post' = (1 − A_DR) × D_post`

**Diminishing returns for stacking DR auras:**\
`A_DR_stack = 1 − Π_k (1 − A_DR_k)` and **cap** `A_DR_stack ≤ DR_cap_sup` (e.g., 0.35)

**Outgoing Damage Amp (ally empowerment)**

Apply to ally’s **non-true** portion pre-target mitigation to avoid double-counting with pen:\
`D_out' = (1 + A_dmg) × D_out_nontrue + D_out_true`

* **DR on stacking amps:**\
  `A_dmg_stack = 1 − Π_k (1 − A_dmg_k)` with **cap** `≤ 0.25` in teamfights.

**Haste/Uptime**

For buffs that increase attacks/casts:\
`AS' = (1 + A_haste) × AS` and recompute ally DPS with their own crit/pen pipeline.

***

#### Cleanses & Immunities

* Cleanse removes `n` debuff categories with an internal cooldown `ICD_cleanse`.
* **Stack DR** on repeated self/ally cleanses affecting the **same target** within 10 s:\
  `duration_removed_eff = duration_removed_base / (1 + λ_cleanse × stacks_on_target)` with `λ_cleanse ≈ 0.5`
* Avoid full immunities; prefer short, narrow windows with visible telegraph.

***

#### Utility Budget (per 10s window)

Define a **Support Utility Score** `U_sup` to keep hybrids in line:

```
U_sup = w_H * (H_total / HP_ref)
      + w_S * (S_total / HP_ref)
      + w_DR * A_DR_stack
      + w_amp * A_dmg_stack
      + w_cleanse * uses_cleanse
      + w_move * uptime_MS
      + w_CC * CC_budget_10s
```

* Choose weights so a “full utility” Support hits `U_sup ≈ 1.0` at parity.
* For “damage-capable hybrid” Supports, require:\
  `DPS_support ≤ α_SUP × DPS_carry_baseline` with `α_SUP ≈ 0.55–0.60`, **and** a minimum `U_sup ≥ 0.7`.

***

#### Anti-Heal & Counter-Sustain

* **Anti-heal (`η`)** affects only **healing**; recommended tiers: 0.6 (light), 0.4 (heavy).
* Shields ignore `η` but respect shield-break (`ξ`) and decay (`κ_S`).
* To avoid stalemates, enforce **teamwide sustain caps** over windows:\
  `H_total_team(10s) + S_total_team(10s) ≤ θ_sustain × Damage_incoming_expected(10s)` with `θ_sustain ≈ 0.65–0.75` in even fights.

***

#### Fragility & Positioning

* Personal EHP of Supports sits **between** DPS and Tanks:\
  `EHP_DPS < EHP_Support < EHP_Tank` at reference state.
* Self-peel exists but is **limited**: short displacements, brief DR, or micro-shields.

***

#### Sanity Checks (Starting Points)

* **Per 10 s window (even fight):**
  * Single-target sustain focus: `HPS + SPS` sufficient to extend TTK on a focused ally by **+30–45%** vs. no-support baseline.
  * Teamwide AoE sustain builds: total `H_total + S_total` capped by `θ_sustain` rule.
* Buff ceilings:
  * `A_dmg_stack ≤ 25%` teamfight;
  * `A_DR_stack ≤ 35%` teamfight;
  * `A_haste` commonly `10–25%` with uptime gating.
* **Hybrid damage guardrail:** `DPS_support ≤ 0.6 × DPS_carry_baseline` at equal budget.

***

#### Example Numbers (illustrative)

**Setup (Δt = 10 s):** Single-target support with two buttons and one aura. Target has `AR_t = 120`, `K_AR = 100` → `DR_phys ≈ 0.545`. Enemy deals `D_in = 500` physical per hit at 2 hits/s.

**Effects**

* **Shield A:** `S_A = 180`, `dur = 4 s`, `κ_S = 0`, `ξ = 0` → `S_eff_A = 180`\
  `CD_A = 6 s` → `casts_A = 1` (using at t=0 → uptime 4 s)
* **Heal B:** `H_B = 260`, single-target, `η = 0.6` (anti-heal present) → `H_eff_B = 156`\
  `CD_B = 5 s` → `casts_B = 2` → `H_total = 312`
* **DR Aura:** `A_DR = 0.12`, uptime `U_DR = 0.6` in window → average `A_DR_avg = 0.072`\
  Apply as post-mitigation, pre-shield.

**Incoming System**

* Per hit post-mitigation: `D_post = (1 − 0.545) × 500 = 228`
* With average DR aura: `D_post' = (1 − 0.072) × 228 ≈ 212.7`

**Shield Absortion**

* Over 4 s shield uptime at 2 hits/s → \~8 hits buffered by `S_A = 180`:\
  Per hit during shield: damage to HP = `max(0, 212.7 − 180) = 32.7`
* After shield expires (remaining 6 s): per hit = `212.7`

**Healing**

* Two heals of `156` applied reactively within the 10 s.

**Net effect (intuition):**

* During shield window, each hit is reduced by \~`180`, vastly lowering HP loss and giving time for the two heals to land.
* Aggregate sustain over 10 s: `S_total = 180`, `H_total = 312` → `492` post-mitigation damage offset, plus `~7.2%` DR averaged.
* Compare to no-support baseline to confirm TTK extends by roughly **\~35–40%** in this setup (within sanity target).

{% hint style="success" %}
**Designer Notes**

* Keep **shields post-mitigation** to avoid explosive vEHP; use `ξ`/`κ_S` to fine-tune counterplay.
* Anti-heal must matter (`η ≤ 0.6` common), but not hard-lock supports out of relevance—shields bypass `η` by design.
* Gate **amps** via uptime and stacking DR to prevent multiplicative blowouts with DPS crit/pen builds.
* Validate balance with **team simulations**: vary `A_DR`, `A_dmg`, and anti-heal levels to hit your target **TTK curves** across skill bands.
{% endhint %}

{% hint style="danger" %}
**Disclaimer & Development Note**

All formulas, constants, and models presented here are **theoretical frameworks** designed to establish initial balance guidelines. They represent an **early mathematical vision** of _Ego Quantum’s_ combat system and are subject to **testing, iteration, and validation** through playtesting and simulation.

These metrics **do not represent final in-game values**. As development progresses and prototypes are implemented, adjustments may be required to ensure:

* Mechanical feel and pacing align with intended gameplay;
* Performance and fairness across all roles remain consistent;
* Accessibility for both developers and players is maintained.

> Since the current project phase is primarily conceptual and my programming knowledge is still limited, these equations and variables are open to future revision once deeper system testing and scripting become possible.
{% endhint %}
