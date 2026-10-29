"""여행 탭 3D 지도 그림(assets/illustrations/korea-terrain.webp)을 실제 행정구역에 맞춰 나눕니다.

그림은 실제 지도보다 단순화돼 있어(동서로 넓고 해안이 매끈함) 실제 경계를 그대로 얹으면 해안선과 어긋납니다.
그래서 실제 경계(시군구 250곳)를 그림 해안선에 맞게 부드럽게 휜 뒤(thin-plate spline), 그림의 땅 픽셀마다
가장 가까운 시군구를 정합니다. 결과물:

- assets/illustrations/korea-pieces/{시도코드}.webp — 도 단위 퍼즐 조각 17장 (경계선을 구워 넣음)
- src/features/discover/lib/koreaMap.generated.ts — 조각 위치·무게중심, 시군구 외곽선(SVG path)·핀 자리

입력: 팀 데모 저장소의 시군구 경계 GeoJSON (vuski/admdongkor ver20220309, 키 SIG_CD = 백엔드 sigCd)
실행: python scripts/korea-map/build.py [sig_original.json 경로]   (numpy·scipy·Pillow 필요)
"""
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "demo/src/main/resources/static/geo/sig_original.json"
ART = ROOT / "assets/illustrations/korea-terrain.webp"
OUT_PIECES = ROOT / "assets/illustrations/korea-pieces"
OUT_TS = ROOT / "src/features/discover/lib/koreaMap.generated.ts"
DEBUG = pathlib.Path(__file__).parent / "_preview"

W, H = 1134, 1368
# src/lib/mapProjection.ts 의 본토 어파인 변환 (출발점)
NX = (0.201368, 0.002539, -25.304134)
NY = (0.023362, -0.184655, 4.196448)
SIDO = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주", "30": "대전", "31": "울산", "36": "세종",
    "41": "경기", "42": "강원", "43": "충북", "44": "충남", "45": "전북", "46": "전남", "47": "경북", "48": "경남", "50": "제주",
}
# 광역시·특별시는 둘러싼 도 위에 그립니다 (도가 들릴 때 구멍 자리를 덮지 않게).
METRO = {"11", "26", "27", "28", "29", "30", "31", "36"}
# 그림 밖으로 계산되는 울릉군은 그림 동해의 바위섬(핀 자리 1049,451 근처)에 붙입니다.
ULLEUNG = ("47940", (1049, 451))
LINE_CORE = 6.2  # 흰 경계선 두께(px, 그림 기준) — 기본 지도에서 약 1.8dp
LINE_HALO = 11.5  # 그 아래 어두운 테두리 두께


def affine(lng, lat):
    return np.stack([(NX[0] * lng + NX[1] * lat + NX[2]) * W, (NY[0] * lng + NY[1] * lat + NY[2]) * H], -1)


def polygons(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


# ── 1. 그림의 땅 ──
art = Image.open(ART).convert("RGBA")
rgba = np.asarray(art).astype(np.int16)
r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
bluish = (b > r + 12) & (b >= g - 6)  # 바다·강
whitish = np.minimum(np.minimum(r, g), b) > 222  # 바다 빛·구름
land = (a > 128) & ~bluish & ~whitish
land = ndi.binary_closing(land, iterations=4)
land = ndi.binary_fill_holes(land)
land = ndi.binary_opening(land, iterations=1)
comp, n = ndi.label(land)
sizes = ndi.sum(land, comp, range(1, n + 1))
land &= np.concatenate([[False], sizes >= 40])[comp]
comp, n = ndi.label(land)
sizes = ndi.sum(land, comp, range(1, n + 1))
order = np.argsort(-sizes) + 1
MAIN, JEJU = int(order[0]), int(order[1])

# ── 2. 실제 본토를 그림 본토에 맞추는 변환 (가까운 해안점끼리 짝지어 점점 덜 매끈하게) ──
feats = json.load(open(SRC, encoding="utf-8"))["features"]
codes = [f["properties"]["sgg"] for f in feats]
mask_img = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask_img)
for f in feats:
    for poly in polygons(f["geometry"]):
        ext = np.array(poly[0])
        if ext[:, 1].max() >= 33.75:
            draw.polygon([tuple(q) for q in affine(ext[:, 0], ext[:, 1])], fill=255)
real = ndi.binary_closing(np.pad(np.asarray(mask_img) > 0, 40), iterations=8)[40:-40, 40:-40]
real = ndi.binary_fill_holes(real)
rl, rn = ndi.label(real)
real = rl == int(np.argmax(ndi.sum(real, rl, range(1, rn + 1)))) + 1
real = ndi.binary_opening(real, iterations=4)


def edge_points(mask, step=3):
    ys, xs = np.nonzero(mask & ~ndi.binary_erosion(mask))
    pts = np.stack([xs, ys], -1).astype(float)
    return pts[np.random.default_rng(0).permutation(len(pts))[: len(pts) // step]]


A, R = edge_points(comp == MAIN), edge_points(real)
tree_a = cKDTree(A)
warp = None
for it, smooth in enumerate([3e4, 1e4, 5e3, 3e3, 2e3, 1e3]):
    rw = warp(R) if warp else R
    max_d = 120 - it * 10
    da, ia = tree_a.query(rw)
    dr, ir = cKDTree(rw).query(A)
    src = np.concatenate([R[da < max_d], R[ir[dr < max_d]]])
    dst = np.concatenate([A[ia[da < max_d]], A[dr < max_d]])
    pick = np.random.default_rng(it).permutation(len(src))[:1500]
    warp = RBFInterpolator(src[pick], dst[pick], kernel="thin_plate_spline", smoothing=smooth)

# 제주는 따로 떨어진 섬이라 실제 섬 범위를 그림 속 섬 범위에 그대로 맞춥니다.
jy, jx = np.nonzero(comp == JEJU)
jeju_ll = np.concatenate([np.array(p[0]) for f in feats if f["properties"]["sgg"].startswith("50") for p in polygons(f["geometry"])])
jeju_ll = jeju_ll[jeju_ll[:, 1] < 33.75]
lo, hi = jeju_ll.min(0), jeju_ll.max(0)


def to_art(code, ring):
    ring = np.asarray(ring)
    if code.startswith("50"):
        return np.stack([jx.min() + (ring[:, 0] - lo[0]) / (hi[0] - lo[0]) * (jx.max() - jx.min()),
                         jy.max() - (ring[:, 1] - lo[1]) / (hi[1] - lo[1]) * (jy.max() - jy.min())], -1)
    return warp(affine(ring[:, 0], ring[:, 1]))


# ── 3. 땅 픽셀마다 시군구 정하기 ──
label_img = Image.new("I", (W, H), 0)
draw = ImageDraw.Draw(label_img)
for k, f in enumerate(feats, start=1):
    for poly in polygons(f["geometry"]):
        draw.polygon([tuple(q) for q in to_art(codes[k - 1], poly[0])], fill=k)
L = np.asarray(label_img).astype(np.int32)
L[~land] = 0
is_jeju = np.array([False] + [c.startswith("50") for c in codes])


def fill_nearest(L, target, allowed):
    """target 픽셀을 allowed 픽셀 중 가장 가까운 라벨로 채웁니다."""
    _, (iy, ix) = ndi.distance_transform_edt(~allowed, return_indices=True)
    L = L.copy()
    L[target] = L[iy, ix][target]
    return L


L = fill_nearest(L, land & (L == 0), L > 0)
for want in (True, False):  # 제주 섬에는 제주 시군구만, 본토에는 본토 시군구만
    wrong = land & ((comp == JEJU) == want) & (is_jeju[L] != want)
    if wrong.any():
        L = fill_nearest(L, wrong, (L > 0) & (is_jeju[L] == want) & ~wrong)
uk = codes.index(ULLEUNG[0]) + 1
islands = [c for c in range(1, n + 1) if c not in (MAIN, JEJU)]
centers = {c: np.array(ndi.center_of_mass(comp == c))[::-1] for c in islands}
rock = min(islands, key=lambda c: np.hypot(*(centers[c] - ULLEUNG[1])))
L[comp == rock] = uk

# 도 경계를 매끈하게: 도별 원-핫을 흐려 가장 큰 쪽으로 (17채널)
sido_codes = sorted(SIDO)
sido_of = np.array([-1] + [sido_codes.index(c[:2]) for c in codes])
P_raw = np.where(land, sido_of[L], -1)
acc = np.full((H, W), -1.0, np.float32)
P = np.full((H, W), -1, np.int16)
for i in range(len(sido_codes)):
    m = ndi.gaussian_filter((P_raw == i).astype(np.float32), 2.2)
    better = m > acc
    acc[better], P[better] = m[better], i
P[~land] = -1
# 섬 하나가 두 도로 쪼개지지 않게, 작은 섬은 원래 다수 도로 통일
for c in islands + [JEJU]:
    m = comp == c
    vals = P_raw[m]
    P[m] = np.bincount(vals[vals >= 0]).argmax()
# 시군구도 매끈해진 도와 어긋나지 않게 고칩니다.
mismatch = land & (sido_of[L] != P)
for i in range(len(sido_codes)):
    t = mismatch & (P == i)
    if t.any():
        L = fill_nearest(L, t, land & (sido_of[L] == i) & ~mismatch)

# ── 4. 경계선 (도와 도 사이, 해안 제외) ──
dist_other = np.full((H, W), np.inf, np.float32)
for i in range(len(sido_codes)):
    d = ndi.distance_transform_edt(P != i).astype(np.float32)
    dist_other = np.where((P >= 0) & (P != i), np.minimum(dist_other, d), dist_other)
# d는 다른 도 픽셀 중심까지 거리(인접 = 1). 경계는 0.5에 있습니다.
edge_d = dist_other - 0.5


def band(width):
    return np.clip(width / 2 + 0.5 - edge_d, 0, 1)


core, halo = band(LINE_CORE), band(LINE_HALO)
base = np.asarray(art).astype(np.float32) / 255
rgb = base[..., :3]
halo_col = np.array([0.05, 0.27, 0.16])
rgb = rgb * (1 - 0.38 * halo[..., None]) + halo_col * 0.38 * halo[..., None]
rgb = rgb * (1 - 0.94 * core[..., None]) + 0.94 * core[..., None]

# ── 5. 도 조각 ──
OUT_PIECES.mkdir(parents=True, exist_ok=True)
# 해안 바깥 2px(그림의 부드러운 가장자리)까지 가장 가까운 조각에 붙입니다.
_, (iy, ix) = ndi.distance_transform_edt(P < 0, return_indices=True)
near = ndi.distance_transform_edt(~land) <= 2.5
P_alpha = np.where(land | near, P[iy, ix], -1)
pieces = []
for i, sc in enumerate(sido_codes):
    m = P_alpha == i
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    alpha = (base[..., 3] * m)[y0:y1, x0:x1]
    out = np.dstack([rgb[y0:y1, x0:x1], alpha])
    Image.fromarray((out * 255).round().astype(np.uint8), "RGBA").save(OUT_PIECES / f"{sc}.webp", "WEBP", quality=88, method=6)
    cy, cx = ndi.center_of_mass(P == i)
    pieces.append({"sido": sc, "name": SIDO[sc], "x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0),
                   "cu": round(cx / W, 4), "cv": round(cy / H, 4)})
# 그리는 순서: 북쪽(뒤)부터 남쪽(앞)으로, 광역시는 도 위에
pieces.sort(key=lambda p: (p["sido"] in METRO, p["cv"]))


# ── 6. 시군구 외곽선 (마칭 스퀘어 → 단순화) 과 핀 자리 ──
def contours(mask):
    """이진 마스크의 0.5 등고선을 닫힌 다각형들로 (흐린 마스크 위에서)."""
    f = ndi.gaussian_filter(mask.astype(np.float32), 1.1)
    f = np.pad(f, 1)
    hh, ww = f.shape
    segs = {}

    def interp(p1, p2, v1, v2):
        t = 0.5 if v2 == v1 else (0.5 - v1) / (v2 - v1)
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))

    above = f > 0.5
    ys, xs = np.nonzero(above[:-1, :-1] | above[1:, :-1] | above[:-1, 1:] | above[1:, 1:])
    out = []
    for y, x in zip(ys, xs):
        v = [f[y, x], f[y, x + 1], f[y + 1, x + 1], f[y + 1, x]]
        idx = sum(1 << j for j in range(4) if v[j] > 0.5)
        if idx in (0, 15):
            continue
        pts = [(x, y), (x + 1, y), (x + 1, y + 1), (x, y + 1)]
        e = {j: interp(pts[j], pts[(j + 1) % 4], v[j], v[(j + 1) % 4]) for j in range(4)}
        table = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 5: [(3, 0), (1, 2)], 6: [(0, 2)], 7: [(3, 2)],
                 8: [(2, 3)], 9: [(2, 0)], 10: [(0, 1), (2, 3)], 11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}
        for s, t in table[idx]:
            out.append((e[s], e[t]))
    # 선분을 이어 고리로
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    nxt = {}
    for s, t in out:
        nxt[key(s)] = (s, t)
    rings, seen = [], set()
    for k0 in list(nxt):
        if k0 in seen:
            continue
        ring, k = [], k0
        while k in nxt and k not in seen:
            seen.add(k)
            s, t = nxt[k]
            ring.append((s[0] - 1, s[1] - 1))
            k = key(t)
        if len(ring) >= 3:
            rings.append(np.array(ring))
    return rings


def simplify(pts, tol):
    """Douglas–Peucker (닫힌 고리)"""
    def dp(p):
        if len(p) < 3:
            return p
        a, b = p[0], p[-1]
        ab = b - a
        n2 = (ab ** 2).sum()
        rel = p - a
        d = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / math.sqrt(n2) if n2 > 0 else np.hypot(*rel.T)
        i = int(np.argmax(d))
        if d[i] <= tol:
            return np.array([a, b])
        return np.concatenate([dp(p[: i + 1])[:-1], dp(p[i:])])
    far = int(np.argmax(np.hypot(*(pts - pts[0]).T)))
    return np.concatenate([dp(pts[: far + 1])[:-1], dp(np.concatenate([pts[far:], pts[:1]]))[:-1]])


def area(p):
    return 0.5 * abs(np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1)))


def path(p):
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in p) + "Z"


regions = {}
for k, code in enumerate(codes, start=1):
    m = L == k
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = max(xs.min() - 3, 0), max(ys.min() - 3, 0), min(xs.max() + 4, W), min(ys.max() + 4, H)
    sub = m[y0:y1, x0:x1]
    rings = sorted((simplify(rg, 0.45) + (x0, y0) for rg in contours(sub)), key=area, reverse=True)
    rings = [rg for rg in rings if len(rg) >= 3]
    main, extra = rings[0], [rg for rg in rings[1:6] if area(rg) >= 30]
    length = float(np.hypot(*np.diff(np.vstack([main, main[:1]]), axis=0).T).sum())
    # 핀 자리: 가장 큰 조각 안에서 경계에서 가장 먼 점
    dt = ndi.distance_transform_edt(sub)
    py, px = np.unravel_index(int(np.argmax(dt)), dt.shape)
    allx = np.concatenate([rg[:, 0] for rg in [main] + extra])
    ally = np.concatenate([rg[:, 1] for rg in [main] + extra])
    regions[code] = {
        "u": round((px + x0 + 0.5) / W, 4), "v": round((py + y0 + 0.5) / H, 4),
        "piece": next(i for i, p in enumerate(pieces) if p["sido"] == code[:2]),
        "box": [round(float(allx.min()) - 1, 1), round(float(ally.min()) - 1, 1),
                round(float(allx.max() - allx.min()) + 2, 1), round(float(ally.max() - ally.min()) + 2, 1)],
        "d": path(main), "extra": "".join(path(rg) for rg in extra), "len": round(length, 1),
    }

# ── 7. TypeScript ──
lines = [
    "// 자동 생성 파일 — scripts/korea-map/build.py 가 만듭니다. 직접 고치지 마세요.",
    "// 좌표는 korea-terrain.webp(1134×1368) 픽셀 기준, u·v·cu·cv는 0~1.",
    "",
    "/** 도 단위 퍼즐 조각 (그리는 순서: 북쪽 → 남쪽, 광역시는 도 위) */",
    "export const MAP_PIECES = [",
]
for p in pieces:
    lines.append(
        f'  {{ sido: "{p["sido"]}", name: "{p["name"]}", x: {p["x"]}, y: {p["y"]}, w: {p["w"]}, h: {p["h"]}, cu: {p["cu"]}, cv: {p["cv"]}, '
        f'source: require("@/assets/illustrations/korea-pieces/{p["sido"]}.webp") }},'
    )
lines += [
    "] as const;",
    "",
    "export type RegionShape = {",
    "  /** 핀을 꽂을 자리 (지역 안에서 경계와 가장 먼 점) */",
    "  u: number;",
    "  v: number;",
    "  /** MAP_PIECES 순번 */",
    "  piece: number;",
    "  /** 외곽선 전체를 감싸는 상자 [x, y, w, h] */",
    "  box: readonly [number, number, number, number];",
    "  /** 가장 큰 땅의 외곽선 · 나머지 섬들 · 외곽선 길이 */",
    "  d: string;",
    "  extra: string;",
    "  len: number;",
    "};",
    "",
    "/** 시군구(sigCd) 250곳의 외곽선과 핀 자리 */",
    "export const REGION_SHAPES: Record<string, RegionShape> = {",
]
for code, s in regions.items():
    lines.append(f'  "{code}": {{ u: {s["u"]}, v: {s["v"]}, piece: {s["piece"]}, box: {json.dumps(s["box"])}, len: {s["len"]}, d: "{s["d"]}", extra: "{s["extra"]}" }},')
lines += ["};", ""]
OUT_TS.write_text("\n".join(lines), encoding="utf-8")

# ── 미리보기 ──
DEBUG.mkdir(exist_ok=True)
prev = Image.fromarray((np.dstack([rgb, base[..., 3]]) * 255).round().astype(np.uint8), "RGBA")
bg = Image.new("RGBA", prev.size, (255, 255, 255, 255))
bg.alpha_composite(prev)
bg.convert("RGB").save(DEBUG / "lines.png")
dbg = bg.copy()
dd = ImageDraw.Draw(dbg)
for code in ["41117", "42150", "26350", "46910", "11110", "47940", "50110", "28720"]:
    s = regions[code]
    for part in (s["d"] + s["extra"]).split("Z"):
        if not part:
            continue
        pts = [tuple(map(float, q.split())) for q in part[1:].split("L")]
        dd.line(pts + [pts[0]], fill=(25, 184, 106, 255), width=3)
    px, py = s["u"] * W, s["v"] * H
    dd.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(220, 30, 30, 255))
dbg.convert("RGB").save(DEBUG / "regions.png")
print("pieces", [(p["sido"], p["w"], p["h"]) for p in pieces])
print("ts", OUT_TS.stat().st_size // 1024, "KB", "pieces", sum(f.stat().st_size for f in OUT_PIECES.iterdir()) // 1024, "KB")
