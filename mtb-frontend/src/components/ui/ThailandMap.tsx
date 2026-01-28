"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { FeatureCollection } from "geojson";
import { Layer, LeafletEvent, PathOptions } from "leaflet";

interface ThailandMapProps {
  districtSummary: { [key: string]: number };
}

const ThailandMap: React.FC<ThailandMapProps> = ({ districtSummary }) => {
  const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(
    null
  );

  useEffect(() => {
    const fetchGeoJson = async () => {
      const response = await fetch("/thailand-districts.geojson");
      const data = await response.json();
      setGeoJsonData(data);
    };

    fetchGeoJson();
  }, []);

  const getColor = (districtName: string) => {
    const count = districtSummary[districtName] || 0;
    if (count > 100) return "#800026";
    if (count > 50) return "#BD0026";
    if (count > 20) return "#E31A1C";
    if (count > 10) return "#FC4E2A";
    if (count > 5) return "#FD8D3C";
    if (count > 2) return "#FEB24C";
    if (count > 0) return "#FED976";
    return "#eeebddff";
  };

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    if (!feature) {
      return {
        weight: 1,
        opacity: 1,
        color: "white",
        dashArray: "3",
        fillOpacity: 0.7,
        fillColor: getColor(""),
      };
    }

    return {
      fillColor: getColor(String(feature.properties?.amp_en ?? "")),
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: Layer) => {
    const provinceNameTh = feature.properties?.pro_th;
    const districtNameTh = feature.properties?.amp_th;
    const districtNameEn = feature.properties?.amp_en;
    const count = districtSummary[districtNameEn] || 0;
    layer.bindTooltip(`${provinceNameTh} (${districtNameTh}): ${count}`);

    const baseStyle: PathOptions = {
      fillColor: getColor(String(feature.properties?.amp_en ?? "")),
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: 0.7,
    };

    layer.on({
      mouseover: (e: LeafletEvent) => {
        const target = e.target as unknown as {
          setStyle?: (opts: PathOptions) => void;
          bringToFront?: () => void;
        };

        if (!target?.setStyle) return;
        try {
          target.setStyle({
            ...baseStyle,
            weight: 3,
            color: "#666",
            dashArray: "",
            fillOpacity: 0.7,
          });
        } catch {
          // Ignore transient Leaflet DOM errors during remounts
        }

        if (typeof target.bringToFront === "function") {
          try {
            target.bringToFront();
          } catch {
            // Ignore transient Leaflet DOM errors during remounts
          }
        }
      },
      mouseout: (e: LeafletEvent) => {
        const target = e.target as unknown as {
          setStyle?: (opts: PathOptions) => void;
        };
        if (!target?.setStyle) return;
        try {
          target.setStyle(baseStyle);
        } catch {
          // Ignore transient Leaflet DOM errors during remounts
        }
      },
    });
  };

  if (!geoJsonData) {
    return <div>Loading map...</div>;
  }

  return (
    <MapContainer
      center={[13.7563, 100.5018]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <GeoJSON data={geoJsonData} style={style} onEachFeature={onEachFeature} />
    </MapContainer>
  );
};

export default ThailandMap;