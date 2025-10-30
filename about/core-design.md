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
  * `β_HP`, `β_AR`, β\_MR → Per-level growth factors
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

