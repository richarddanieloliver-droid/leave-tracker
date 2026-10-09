"""Rasterise the app icon (same shapes as public/icon.svg) to PNG with the standard library."""
import struct, zlib, sys

POLY = [(76, 380), (196, 210), (262, 296), (330, 170), (436, 380)]

def inside(x, y, poly):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c

def pixel(x, y):
    bg = (13, 7, 22)
    t = (x + y) / 1024
    grad = tuple(round(a + (b - a) * t) for a, b in zip((255, 60, 172), (123, 47, 247)))
    if inside(x, y, POLY):
        return grad
    if (x - 376) ** 2 + (y - 132) ** 2 <= 34 ** 2:
        return (255, 60, 172)
    return bg

def png(size, path):
    s = 512 / size
    raw = b''.join(b'\0' + bytes(c for x in range(size) for c in pixel((x + .5) * s, (y + .5) * s)) for y in range(size))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

for n in (192, 512):
    png(n, f'{sys.argv[1]}/icon-{n}.png')
