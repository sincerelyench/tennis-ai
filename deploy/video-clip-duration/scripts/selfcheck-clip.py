#!/usr/bin/env python3
"""Pure-python mirror of clip.ts rules for smoke checks."""
CLIP_MIN = 10.0
CLIP_DEFAULT = 10.0

def is_short(d):
    return d >= 0.2 and d < CLIP_MIN

def default_range(d):
    if d < 0.2: return None
    if is_short(d): return (0, round(d*100)/100)
    return (0, min(d, CLIP_DEFAULT))

def clamp(start, end, d):
    if d < CLIP_MIN:
        return (0, round(d*100)/100)
    start = min(max(0, start), max(0, d - CLIP_MIN))
    end = min(d, max(start + CLIP_MIN, end))
    if end - start < CLIP_MIN:
        if start + CLIP_MIN <= d:
            end = start + CLIP_MIN
        else:
            end = d
            start = max(0, end - CLIP_MIN)
    return (round(start*100)/100, round(end*100)/100)

def valid(start, end, d):
    if d < 0.2: return False
    if start < -0.02 or end > d + 0.05: return False
    if is_short(d):
        return start <= 0.05 and abs(end - d) <= 0.08
    return (end - start) >= CLIP_MIN - 0.02

assert default_range(8) == (0, 8)
assert default_range(30) == (0, 10)
assert clamp(0, 10, 30) == (0, 10)
assert clamp(0, 25, 30) == (0, 25)  # can extend
assert clamp(0, 5, 30) == (0, 10)   # min 10
assert clamp(20, 35, 30) == (20, 30)
assert valid(0, 10, 30)
assert valid(0, 20, 30)
assert not valid(0, 5, 30)
assert valid(0, 8, 8)
print('selfcheck ok')
