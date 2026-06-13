"""
crowd_detector.py — Member 1: Computer Vision Lead
Simulates an event-camera pipeline using frame differencing.
Outputs a spike grid (10x10) representing motion events per zone.
"""

import numpy as np
import time

GRID_ROWS = 10
GRID_COLS = 10

# Internal state
_prev_frame = None
_spike_history = []  # list of spike grids over time

def _generate_base_noise(level=0.05):
    """Background noise — tiny random motion in a calm crowd."""
    return np.random.rand(GRID_ROWS, GRID_COLS) * level

def get_spike_grid(scenario="normal"):
    """
    Simulate frame differencing → spike generation.
    Returns a (10,10) numpy array of spike intensities [0, 1].
    """
    global _spike_history

    if scenario == "normal":
        # Calm crowd — sparse low-intensity spikes
        grid = _generate_base_noise(0.08)
        # A few cells have slightly more activity
        for _ in range(np.random.randint(3, 8)):
            r, c = np.random.randint(0, GRID_ROWS), np.random.randint(0, GRID_COLS)
            grid[r][c] = np.random.uniform(0.1, 0.25)

    elif scenario == "kumbh_surge":
        # Large crowd moving — correlated medium spikes in clusters
        grid = _generate_base_noise(0.15)
        # Hotspot cluster — pilgrimage entry zone (top-center)
        for r in range(2, 6):
            for c in range(3, 7):
                grid[r][c] = np.random.uniform(0.45, 0.75)
        # Spillover
        for _ in range(10):
            r, c = np.random.randint(0, GRID_ROWS), np.random.randint(0, GRID_COLS)
            grid[r][c] = np.random.uniform(0.3, 0.55)

    elif scenario == "crush":
        # Pressure wave — sudden high-density burst, spatially correlated
        grid = np.ones((GRID_ROWS, GRID_COLS)) * 0.3
        # Crush zone (center-right — Zone C4)
        for r in range(3, 8):
            for c in range(4, 9):
                grid[r][c] = np.random.uniform(0.78, 1.0)
        # Bidirectional conflict zone
        grid[5][5] = 1.0
        grid[5][6] = 1.0
        grid[6][5] = 0.98

    else:
        grid = _generate_base_noise(0.05)

    _spike_history.append(grid)
    if len(_spike_history) > 20:
        _spike_history.pop(0)

    return grid.tolist()

def get_spike_rate():
    """Average spike intensity over last N frames — key metric."""
    if not _spike_history:
        return 0.0
    arr = np.array(_spike_history)
    return float(np.mean(arr))

def get_flow_variance():
    """
    Simulates optical flow variance — high variance = turbulent crowd.
    In a real system this uses Lucas-Kanade or Farneback optical flow.
    """
    if len(_spike_history) < 2:
        return 0.0
    diff = np.array(_spike_history[-1]) - np.array(_spike_history[-2])
    return float(np.var(diff))
