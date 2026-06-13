"""
spike_generator.py  —  Member 2: Neuromorphic Engine
NeuroWatch | Hackathon Sprint

Implements:
  - Leaky Integrate-and-Fire (LIF) neuron simulation on a 10×10 grid
  - STDP-inspired weight update: co-firing adjacent cells → stronger weights
  - Output: spike_density_score per time window

Used by: risk_engine.py  (imported as a module)
Also called by: app.py via  get_spike_grid(scenario), get_spike_rate(), get_flow_variance()
"""

import numpy as np
import time

# ─── Constants ──────────────────────────────────────────────────────────────

GRID_SIZE   = 10          # 10 × 10 grid
DT          = 1.0         # time step (ms)
TAU_M       = 20.0        # membrane time constant (ms)
V_RESET     = 0.0         # reset potential after spike
V_THRESH    = 1.0         # firing threshold
TAU_STDP    = 20.0        # STDP time window (ms)
W_MAX       = 2.0         # max synaptic weight
W_MIN       = 0.0         # min synaptic weight
A_PLUS      = 0.01        # STDP potentiation rate
A_MINUS     = 0.012       # STDP depression rate  (slightly > A+ → weight stability)

# Scenario base-drive intensities  (injected current per cell, before noise)
SCENARIO_DRIVE = {
    "normal":      0.30,
    "kumbh_surge": 0.72,
    "crush":       0.95,
}

# ─── LIF Grid ───────────────────────────────────────────────────────────────

class LIFGrid:
    """
    10×10 grid of Leaky Integrate-and-Fire neurons.

    Each neuron maintains:
      v        — membrane potential
      spikes   — binary spike matrix (this time step)
      t_last   — time of last spike (for STDP)
      weights  — 10×10×4 array of synaptic weights to 4-neighbours (N,S,E,W)
    """

    NEIGHBOUR_OFFSETS = [(-1, 0), (1, 0), (0, 1), (0, -1)]   # N S E W

    def __init__(self):
        self.v       = np.zeros((GRID_SIZE, GRID_SIZE))
        self.spikes  = np.zeros((GRID_SIZE, GRID_SIZE), dtype=bool)
        self.t_last  = np.full((GRID_SIZE, GRID_SIZE), -np.inf)
        # 4 directional weights, initialised near 0.5
        self.weights = np.full((GRID_SIZE, GRID_SIZE, 4), 0.5)
        self.t       = 0.0                        # simulation clock (ms)
        self._spike_history: list[np.ndarray] = []   # rolling buffer (last 10 steps)

    # ── Single timestep ──────────────────────────────────────────────────────

    def step(self, drive: np.ndarray) -> np.ndarray:
        """
        Advance the grid by DT ms given an external drive matrix (0–1).
        Returns the spike matrix (bool 10×10).
        """
        # 1. Synaptic input from neighbours (weighted sum of their last spikes)
        syn_input = self._synaptic_input()

        # 2. LIF membrane update:  dv/dt = (-v + I_ext + I_syn) / tau
        I_total = drive + syn_input
        self.v  = self.v + DT * ((-self.v + I_total) / TAU_M)

        # 3. Threshold check → fire
        fired = self.v >= V_THRESH
        self.v[fired] = V_RESET

        # 4. STDP weight update (must happen before updating t_last)
        if fired.any():
            self._stdp_update(fired)

        # 5. Record spike times
        self.t_last[fired] = self.t
        self.spikes = fired
        self.t += DT

        # 6. Rolling history (keep last 10 steps)
        self._spike_history.append(fired.astype(float))
        if len(self._spike_history) > 10:
            self._spike_history.pop(0)

        return fired

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _synaptic_input(self) -> np.ndarray:
        """Weighted sum of last spike from each of 4 neighbours."""
        inp = np.zeros((GRID_SIZE, GRID_SIZE))
        last_spike = self.spikes.astype(float)
        for k, (di, dj) in enumerate(self.NEIGHBOUR_OFFSETS):
            shifted = np.roll(last_spike, shift=(-di, -dj), axis=(0, 1))
            # zero out wrap-around edges
            if di == -1: shifted[-1, :] = 0
            if di ==  1: shifted[ 0, :] = 0
            if dj == -1: shifted[:, -1] = 0
            if dj ==  1: shifted[:,  0] = 0
            inp += self.weights[:, :, k] * shifted
        return inp

    def _stdp_update(self, fired: np.ndarray):
        """
        STDP-inspired weight update:
          - Pre fires before post  → potentiate (A+)
          - Post fires before pre  → depress  (A-)
        Applied to all pairs of co-firing adjacent cells.
        """
        for k, (di, dj) in enumerate(self.NEIGHBOUR_OFFSETS):
            # "pre" neuron is the neighbour
            pre_t  = np.roll(self.t_last, shift=(-di, -dj), axis=(0, 1))
            delta_t = self.t - pre_t          # positive → pre fired earlier

            # Potentiate where both fired and pre preceded post
            ltp_mask = fired & (self.spikes | (delta_t > 0))
            dw_plus  = A_PLUS * np.exp(-np.abs(delta_t) / TAU_STDP) * ltp_mask

            # Depress where post fired first
            ltd_mask = fired & (delta_t < 0)
            dw_minus = A_MINUS * np.exp(-np.abs(delta_t) / TAU_STDP) * ltd_mask

            self.weights[:, :, k] += dw_plus - dw_minus
            self.weights[:, :, k]  = np.clip(self.weights[:, :, k], W_MIN, W_MAX)

    # ── Public outputs ────────────────────────────────────────────────────────

    def spike_density_score(self) -> float:
        """
        Mean spike density over the rolling window  (0.0 – 1.0).
        Used by risk_engine as the 'density' term.
        """
        if not self._spike_history:
            return 0.0
        return float(np.mean(self._spike_history))

    def spike_rate(self) -> float:
        """Average spike intensity (alias for density; used by app.py)."""
        return self.spike_density_score()

    def flow_variance(self) -> float:
        """
        Variance of spike counts across cells over the rolling window.
        Simulates optical-flow turbulence — high variance = chaotic crowd movement.
        """
        if not self._spike_history:
            return 0.0
        stack = np.stack(self._spike_history, axis=0)   # (T, 10, 10)
        cell_rates = stack.mean(axis=0)                  # mean firing per cell
        return float(np.var(cell_rates))


# ─── Stateful singleton (shared with app.py) ────────────────────────────────

_grid = LIFGrid()
_current_scenario = "normal"


def _make_drive(scenario: str) -> np.ndarray:
    """Build a noisy 10×10 drive matrix for the given scenario."""
    base  = SCENARIO_DRIVE.get(scenario, 0.30)
    noise = np.random.uniform(-0.05, 0.05, (GRID_SIZE, GRID_SIZE))

    if scenario == "crush":
        # Concentrate drive in a central hotspot (mimics crowd crush core)
        drive = np.full((GRID_SIZE, GRID_SIZE), base * 0.6)
        drive[3:7, 3:7] = base          # zone C4–G7 hotspot
        drive[4:6, 4:6] = min(base * 1.1, 1.0)

    elif scenario == "kumbh_surge":
        # Surge along one axis (pilgrims streaming through a corridor)
        drive = np.full((GRID_SIZE, GRID_SIZE), base * 0.5)
        drive[:, 4:7] = base            # vertical corridor surge

    else:  # normal
        drive = np.full((GRID_SIZE, GRID_SIZE), base)

    return np.clip(drive + noise, 0.0, 1.0)


# ─── Public API (called by app.py) ──────────────────────────────────────────

def set_scenario(scenario: str):
    """Switch the active scenario.  Called from app.py POST /api/scenario."""
    global _current_scenario
    if scenario in SCENARIO_DRIVE:
        _current_scenario = scenario


def get_spike_grid(scenario: str | None = None) -> list[list[float]]:
    """
    Run one LIF step and return the 10×10 spike-intensity grid.
    Values are floats in [0, 1]; suitable for the frontend HeatMap.

    Args:
        scenario: override scenario for this call (optional).
    Returns:
        list[list[float]]  — 10 rows × 10 cols
    """
    sc    = scenario or _current_scenario
    drive = _make_drive(sc)
    _grid.step(drive)

    # Return rolling mean intensity (smoother than raw binary spikes)
    if _grid._spike_history:
        intensity = np.stack(_grid._spike_history, axis=0).mean(axis=0)
    else:
        intensity = drive

    # Scale to [0, 1]
    intensity = np.clip(intensity, 0.0, 1.0)
    return intensity.tolist()


def get_spike_rate() -> float:
    """
    Average spike intensity over the last N frames.
    Mapped to [0, 1].  Used in the risk formula.
    """
    return _grid.spike_rate()


def get_flow_variance() -> float:
    """
    Simulated optical-flow turbulence (variance of per-cell firing rates).
    Normalised to [0, 1] for the risk formula.
    """
    raw = _grid.flow_variance()
    # Variance of Bernoulli(p) ≤ 0.25; normalise accordingly
    return min(raw / 0.25, 1.0)


def get_spike_density_score() -> float:
    """Direct access to spike_density_score (used by risk_engine)."""
    return _grid.spike_density_score()
