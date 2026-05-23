#!/usr/bin/env python3
"""Generate build/icon.ico with no external dependencies.

Renders a 256x256 emblem (a play triangle inside a loop ring on a warm
rounded-square background) at 4x supersampling for anti-aliasing, encodes it
as a PNG, then wraps the PNG in a single-entry .ico (256x256), which is the
format electron-builder expects for Windows.
"""
import math
import struct
import zlib
import os

SS = 4               # supersample factor
SIZE = 256
N = SIZE * SS        # 1024
C = N / 2.0

# --- palette ---
BG_TOP = (46, 38, 28)
BG_BOT = (26, 20, 15)
RING = (224, 169, 85)
PLAY = (244, 232, 208)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def sd_round_box(px, py, b, r):
    qx = abs(px) - b + r
    qy = abs(py) - b + r
    ax, ay = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r


# play triangle vertices (scaled to supersampled space)
def s(v):
    return v * SS

AX, AY = s(40), s(0)
BX, BY = s(-30), s(-40)
DX, DY = s(-30), s(40)


def in_triangle(px, py):
    def cross(ox, oy, ux, uy, vx, vy):
        return (ux - ox) * (vy - oy) - (uy - oy) * (vx - ox)
    d1 = cross(px, py, AX, AY, BX, BY)
    d2 = cross(px, py, BX, BY, DX, DY)
    d3 = cross(px, py, DX, DY, AX, AY)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


B = s(122)           # rounded-box half size
R = s(50)            # corner radius
RING_R = s(80)       # loop ring radius
RING_HW = s(12)      # ring half stroke

# render supersampled RGBA rows
hires = bytearray(N * N * 4)
for y in range(N):
    rel_y = y - C
    grad = lerp(BG_TOP, BG_BOT, y / (N - 1))
    row = y * N * 4
    for x in range(N):
        rel_x = x - C
        i = row + x * 4
        # background rounded square
        if sd_round_box(rel_x, rel_y, B, R) < 0:
            r, g, b = grad
            a = 255
        else:
            r = g = b = a = 0
        # loop ring (over bg)
        if abs(math.hypot(rel_x, rel_y) - RING_R) < RING_HW:
            r, g, b = RING
            a = 255
        # play triangle (top)
        if in_triangle(rel_x, rel_y):
            r, g, b = PLAY
            a = 255
        hires[i] = r
        hires[i + 1] = g
        hires[i + 2] = b
        hires[i + 3] = a

# box-downsample SS*SS -> 1 with proper alpha-weighted color
px = bytearray(SIZE * SIZE * 4)
samples = SS * SS
for oy in range(SIZE):
    for ox in range(SIZE):
        sr = sg = sb = sa = 0
        for dy in range(SS):
            yy = oy * SS + dy
            base = (yy * N + ox * SS) * 4
            for dx in range(SS):
                j = base + dx * 4
                a = hires[j + 3]
                sr += hires[j] * a
                sg += hires[j + 1] * a
                sb += hires[j + 2] * a
                sa += a
        o = (oy * SIZE + ox) * 4
        if sa > 0:
            px[o] = sr // sa
            px[o + 1] = sg // sa
            px[o + 2] = sb // sa
        px[o + 3] = sa // samples


def png_bytes(width, height, rgba):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter: none
        raw += rgba[y * stride:(y + 1) * stride]
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


png = png_bytes(SIZE, SIZE, px)

# ICO with a single PNG-encoded 256x256 entry (width/height byte 0 == 256)
ico = bytearray()
ico += struct.pack("<HHH", 0, 1, 1)
ico += struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 22)
ico += png

os.makedirs("build", exist_ok=True)
with open("build/icon.ico", "wb") as f:
    f.write(ico)
with open("build/icon.png", "wb") as f:
    f.write(png)
print("wrote build/icon.ico", len(ico), "bytes; build/icon.png", len(png), "bytes")
