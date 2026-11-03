"""Bir kez çalıştırılır: Natural Earth 1:10m il sınırlarından sadeleştirilmiş Türkiye haritası üretir.

  python harita_hazirla.py ne_10m_admin_1_states_provinces.geojson

Kaynak dosya: https://github.com/nvkelso/natural-earth-vector (kamu malı).
Çıktı: site/veri/iller.geojson (özellik: plaka)
"""
import json
import sys
from pathlib import Path

from shapely.geometry import MultiPolygon, mapping, shape
from shapely.geometry.polygon import orient

KOK = Path(__file__).resolve().parent
TOLERANS = 0.012  # derece; ~1 km, il ölçeğinde gözle fark edilmez


def _yuvarla(o):
    if isinstance(o, float):
        return round(o, 3)
    if isinstance(o, (list, tuple)):
        return [_yuvarla(x) for x in o]
    return o


def main(kaynak):
    d = json.loads(Path(kaynak).read_text(encoding="utf-8"))
    cikti = []
    for f in d["features"]:
        p = f["properties"]
        if p.get("adm0_a3") != "TUR":
            continue
        plaka = int(p["iso_3166_2"].split("-")[1])
        g = shape(f["geometry"]).simplify(TOLERANS, preserve_topology=True)
        # d3-geo dış halkayı saat yönünde bekler
        g = (MultiPolygon([orient(q, -1.0) for q in g.geoms]) if g.geom_type == "MultiPolygon"
             else orient(g, -1.0))
        geo = mapping(g)
        cikti.append({"type": "Feature", "properties": {"plaka": plaka},
                      "geometry": {"type": geo["type"], "coordinates": _yuvarla(geo["coordinates"])}})
    assert len(cikti) == 81, len(cikti)
    cikti.sort(key=lambda f: f["properties"]["plaka"])
    hedef = KOK / "site" / "veri" / "iller.geojson"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(json.dumps({"type": "FeatureCollection", "features": cikti},
                                separators=(",", ":")), encoding="utf-8")
    print(f"{hedef} ({hedef.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
