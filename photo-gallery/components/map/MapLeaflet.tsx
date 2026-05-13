"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { GeoPoint } from "./MapClient";

interface Props {
  items: GeoPoint[];
  authToken: string;
  mode: "markers" | "heat";
}

function thumbUrl(storage_key: string, token: string) {
  return `/api/gallery/thumb/${storage_key}?t=${encodeURIComponent(token)}`;
}

export default function MapLeaflet({ items, authToken, mode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const fitOnceRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      preferCanvas: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // crossOrigin lets html-to-image snapshot the tiles without CORS
      // taint, so the PrivacyControls screenshot widget can capture the
      // map. OSM tile servers serve `Access-Control-Allow-Origin: *`.
      crossOrigin: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    if (mode === "heat") {
      const points = items.map((it) => [it.latitude, it.longitude, 0.6] as [number, number, number]);
      const heat = (L as any).heatLayer(points, {
        radius: 25,
        blur: 18,
        maxZoom: 17,
        gradient: {
          0.2: "#4c1d95",
          0.4: "#7c3aed",
          0.6: "#a855f7",
          0.8: "#ec4899",
          1: "#f43f5e",
        },
      });
      heat.addTo(map);
      heatRef.current = heat;
      for (const it of items) bounds.extend([it.latitude, it.longitude]);
    } else {
      const cluster = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50,
      });

      for (const it of items) {
        const url = thumbUrl(it.storage_key, authToken);
        const escapedAlt = it.filename.replace(/"/g, "&quot;");
        const icon = L.divIcon({
          className: "gallery-map-pin",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          html: `<div class="gmm-pin"><img src="${url}" alt="${escapedAlt}" loading="lazy" /></div>`,
        });
        const marker = L.marker([it.latitude, it.longitude], { icon });
        const popupHtml = `
          <a href="/gallery?open=${it.id}" style="display:block;text-decoration:none;color:inherit;">
            <img src="${url}" alt="${escapedAlt}" style="width:160px;height:120px;object-fit:cover;border-radius:6px;display:block;margin-bottom:6px;" />
            <div style="font-size:12px;font-weight:500;">${escapedAlt}</div>
            <div style="font-size:11px;color:#9ca3af;">${
              it.location_name || `${it.latitude.toFixed(4)}, ${it.longitude.toFixed(4)}`
            }</div>
            <div style="font-size:11px;color:#9ca3af;">${new Date(it.taken_at).toLocaleDateString()}</div>
          </a>`;
        marker.bindPopup(popupHtml, { maxWidth: 200, className: "gallery-map-popup" });
        cluster.addLayer(marker);
        bounds.extend([it.latitude, it.longitude]);
      }

      map.addLayer(cluster);
      clusterRef.current = cluster;
    }

    if (!fitOnceRef.current && items.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      fitOnceRef.current = true;
    } else if (items.length === 0) {
      map.setView([0, 0], 2);
    }
  }, [items, authToken, mode]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      <style jsx global>{`
        .gallery-map-pin {
          background: transparent;
          border: 0;
        }
        .gmm-pin {
          width: 44px;
          height: 44px;
          border-radius: 9999px;
          overflow: hidden;
          border: 2px solid #a78bfa;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
          background: #1f2937;
        }
        .gmm-pin img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gallery-map-popup .leaflet-popup-content-wrapper {
          background: #111827;
          color: #e5e7eb;
          border: 1px solid #374151;
        }
        .gallery-map-popup .leaflet-popup-tip {
          background: #111827;
          border: 1px solid #374151;
        }
        .gallery-map-popup .leaflet-popup-content {
          margin: 10px 12px;
        }
      `}</style>
    </>
  );
}
