"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import API_URL from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import BoxPlotChart from "@/components/ui/BoxPlotChart";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const ThailandMap = dynamic(() => import("@/components/ui/ThailandMap"), {
  ssr: false,
});

const NUM_RECENT_CLUSTERS = 5;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

interface RawClusterData {
  patient_id: string;
  sample_id: string;
  collection_date: string;
  district: string;
  province: string;
  age: string;
  chest_x_ray: string;
  coverage: string;
  education: string;
  ethnic_group: string;
  lineage: string;
  major_lineage: string;
  mean_base_qual: string;
  mean_depth: string;
  mean_mapping_qual: string;
  number_of_SNPs_supporting_lineage_assignment: string;
  number_of_bases_covered: string;
  number_of_reads: string;
  occupation: string;
  overall_DR_genotype: string;
  seq_id: string;
  sex: string;
  treatment_outcome: string;
}

interface RecentCluster {
  id: string;
  risk: string;
  status: string;
  assignedTo: string;
}

interface BoxPlotData {
  year: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

interface TransformedData {
  totalClusters: number;
  riskLevelSummary: {
    title: string;
    value: number;
  }[];
  recentClusters: RecentCluster[];
  clusterDistribution: {
    risk: string;
    count: number;
  }[];
  lineageDistribution: {
    name: string;
    value: number;
  }[];
  provinceDistribution: {
    name: string;
    value: number;
  }[];
  districtSummary: {
    [key: string]: number;
  };
  collectionYearDistribution: {
    year: string;
    count: number;
  }[];
  collectionYearSexDistribution: {
    year: string;
    maleCount: number;
    femaleCount: number;
  }[];
  collectionYearAgeBoxPlot: BoxPlotData[];
  collectionYearEthnicGroupDistribution: {
    year: string;
    [ethnicGroup: string]: string | number;
  }[];
  ethnicGroups: string[];
  collectionYearEducationDistribution: {
    year: string;
    [educationLevel: string]: string | number;
  }[];
  educationLevels: string[];
  collectionYearOccupationDistribution: {
    year: string;
    [occupation: string]: string | number;
  }[];
  occupations: string[];
}

type DashboardFilters = {
  province: string;
  collectionDateStart: string; // YYYY-MM-DD
  collectionDateEnd: string; // YYYY-MM-DD
  majorLineage: string;
  overallDRGenotype: string;
  lineage: string;
};

type FilterKey = keyof DashboardFilters;

const normalizeValue = (value: string | undefined | null) =>
  (value ?? "").toString().trim() || "Unknown";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const coerceRawClusterRows = (payload: unknown): RawClusterData[] => {
  if (Array.isArray(payload)) return payload as RawClusterData[];
  if (!isRecord(payload)) return [];

  const candidates: unknown[] = [
    payload.data,
    payload.rows,
    payload.result,
    payload.results,
    payload.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as RawClusterData[];
  }

  return [];
};

const normalizeDate = (value: string | undefined | null) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";

  if (raw.includes("T")) return raw.split("T")[0] ?? "";
  if (raw.includes(" ")) return raw.split(" ")[0] ?? "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const applyFilters = (
  rows: RawClusterData[] | null | undefined,
  filters: DashboardFilters,
  exclude?: FilterKey
) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return safeRows.filter((row) => {
    if (exclude !== "province" && filters.province) {
      if (normalizeValue(row.province) !== filters.province) return false;
    }
    if (exclude !== "majorLineage" && filters.majorLineage) {
      if (normalizeValue(row.major_lineage) !== filters.majorLineage) return false;
    }
    if (exclude !== "lineage" && filters.lineage) {
      if (normalizeValue(row.lineage) !== filters.lineage) return false;
    }
    if (exclude !== "overallDRGenotype" && filters.overallDRGenotype) {
      if (normalizeValue(row.overall_DR_genotype) !== filters.overallDRGenotype)
        return false;
    }
    if (
      exclude !== "collectionDateStart" &&
      exclude !== "collectionDateEnd" &&
      filters.collectionDateStart &&
      filters.collectionDateEnd
    ) {
      const rowDate = normalizeDate(row.collection_date);
      if (!rowDate) return false;

      const start = filters.collectionDateStart;
      const end = filters.collectionDateEnd;

      const min = start <= end ? start : end;
      const max = start <= end ? end : start;
      if (rowDate < min || rowDate > max) return false;
    }

    return true;
  });
};

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const radioValue = value || "__ALL__";

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="truncate">{value || "All"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-h-72 overflow-auto">
          <DropdownMenuRadioGroup
            value={radioValue}
            onValueChange={(next) => onChange(next === "__ALL__" ? "" : next)}
          >
            <DropdownMenuRadioItem value="__ALL__">All</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {options.map((opt) => (
              <DropdownMenuRadioItem key={opt} value={opt}>
                {opt}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const transformBackendData = (
  rawData: RawClusterData[]
): TransformedData => {
  const totalClusters = rawData.length;

  // Calculate summary of risk levels
  const riskLevelMap = rawData.reduce((acc, curr) => {
    const risk = curr.overall_DR_genotype || "Unknown";
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Format for summary cards
  const riskLevelSummary = Object.entries(riskLevelMap).map(
    ([title, value]) => ({
      title,
      value,
    })
  );

  // Format for cluster distribution chart
  const clusterDistribution = Object.entries(riskLevelMap).map(
    ([risk, count]) => ({
      risk,
      count,
    })
  );

  // Calculate lineage distribution
  const lineageDistributionMap = rawData.reduce((acc, curr) => {
    const lineage = curr.major_lineage || "Unknown";
    acc[lineage] = (acc[lineage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lineageDistribution = Object.entries(lineageDistributionMap).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  // Calculate province distribution
  const provinceDistributionMap = rawData.reduce((acc, curr) => {
    const province = curr.province || "Unknown";
    acc[province] = (acc[province] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const provinceDistribution = Object.entries(provinceDistributionMap).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  // Summarize data by district
  const districtSummary = rawData.reduce((acc, curr) => {
    const district = curr.district || "Unknown";
    acc[district] = (acc[district] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const collectionYearDistributionMap = rawData.reduce((acc, curr) => {
    const year = curr.collection_date
      ? new Date(curr.collection_date).getFullYear().toString()
      : "Unknown";
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const collectionYearDistribution = Object.entries(
    collectionYearDistributionMap
  ).map(([year, count]) => ({
    year,
    count,
  }));

  // Get a few recent clusters for the table
  const recentClusters: RecentCluster[] = rawData
    .slice(0, NUM_RECENT_CLUSTERS)
    .map((item) => ({
      id: item.sample_id,
      risk: item.overall_DR_genotype || "Unknown",
      status: item.major_lineage || "Unknown",
      assignedTo: "N/A", // Not available in the provided data
    }));

  const collectionYearSexDistributionMap = rawData.reduce((acc, curr) => {
    const year = curr.collection_date
      ? new Date(curr.collection_date).getFullYear().toString()
      : "Unknown";
    if (!acc[year]) {
      acc[year] = { year, maleCount: 0, femaleCount: 0 };
    }
    if (curr.sex?.toLowerCase() === "male") {
      acc[year].maleCount += 1;
    } else if (curr.sex?.toLowerCase() === "female") {
      acc[year].femaleCount += 1;
    }
    return acc;
  }, {} as Record<string, { year: string; maleCount: number; femaleCount: number }>);

  const collectionYearSexDistribution = Object.values(collectionYearSexDistributionMap);

  // Helper function to calculate quartile and median
  const calculateBoxPlotStats = (data: number[]) => {
    if (data.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }

    const sortedData = [...data].sort((a, b) => a - b);
    const n = sortedData.length;

    const median = n % 2 === 0
      ? (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2
      : sortedData[Math.floor(n / 2)];

    const getQuartile = (arr: number[], quartile: number) => {
      const pos = (arr.length - 1) * quartile;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (arr[base + 1] !== undefined) {
        return arr[base] + rest * (arr[base + 1] - arr[base]);
      } else {
        return arr[base];
      }
    };

    const q1 = getQuartile(sortedData, 0.25);
    const q3 = getQuartile(sortedData, 0.75);

    const min = sortedData[0];
    const max = sortedData[n - 1];

    return { min, q1, median, q3, max };
  };

  // Calculate collection year and age box plot data
  const yearAgeMap = rawData.reduce((acc, curr) => {
    const year = curr.collection_date
      ? new Date(curr.collection_date).getFullYear().toString()
      : "Unknown";
    const age = parseInt(curr.age);
    if (!isNaN(age)) {
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(age);
    }
    return acc;
  }, {} as Record<string, number[]>);

  const collectionYearAgeBoxPlot: BoxPlotData[] = Object.entries(yearAgeMap)
    .map(([year, ages]) => {
      const stats = calculateBoxPlotStats(ages);
      return { year, ...stats };
    })
    .sort((a, b) => parseInt(a.year) - parseInt(b.year)); // Sort by year

  // Calculate ethnic group distribution by year
  const ethnicGroups = [...new Set(rawData.map(item => item.ethnic_group || "Unknown"))];
    const collectionYearEthnicGroupDistribution = rawData.reduce((acc, curr) => {
      const year = curr.collection_date
        ? new Date(curr.collection_date).getFullYear().toString()
        : "Unknown";

      let yearData: { year: string; [key: string]: string | number } | undefined = acc.find(item => item.year === year);
      if (!yearData) {
        const newYearData: { year: string; [key: string]: string | number } = { year };
        ethnicGroups.forEach(group => {
          newYearData[group] = 0;
        });
        acc.push(newYearData);
        yearData = newYearData;
      }

      const ethnicGroup = curr.ethnic_group || "Unknown";
      if (yearData[ethnicGroup] !== undefined) {
        yearData[ethnicGroup] = (yearData[ethnicGroup] as number) + 1;
      }

      return acc;
    }, [] as { year: string; [ethnicGroup: string]: string | number; }[]);

  // Sort by year
  collectionYearEthnicGroupDistribution.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Calculate education distribution by year
  const educationLevels = [...new Set(rawData.map(item => item.education || "Unknown"))];
  const collectionYearEducationDistribution = rawData.reduce((acc, curr) => {
    const year = curr.collection_date
      ? new Date(curr.collection_date).getFullYear().toString()
      : "Unknown";
    
    let yearData: { year: string; [key: string]: string | number } | undefined = acc.find(item => item.year === year);
    if (!yearData) {
      const newYearData: { year: string; [key: string]: string | number } = { year };
      educationLevels.forEach(level => {
        newYearData[level] = 0;
      });
      acc.push(newYearData);
      yearData = newYearData;
    }
    
    const education = curr.education || "Unknown";
    if (yearData[education] !== undefined) {
      yearData[education] = (yearData[education] as number) + 1;
    }

    return acc;
  }, [] as { year: string; [educationLevel: string]: string | number; }[]);

  // Sort by year
  collectionYearEducationDistribution.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Calculate occupation distribution by year
  const occupations = [...new Set(rawData.map(item => item.occupation || "Unknown"))];
  const collectionYearOccupationDistribution = rawData.reduce((acc, curr) => {
    const year = curr.collection_date
      ? new Date(curr.collection_date).getFullYear().toString()
      : "Unknown";
    
    let yearData: { year: string; [key: string]: string | number } | undefined = acc.find(item => item.year === year);
    if (!yearData) {
      const newYearData: { year: string; [key: string]: string | number } = { year };
      occupations.forEach(occ => {
        newYearData[occ] = 0;
      });
      acc.push(newYearData);
      yearData = newYearData;
    }
    
    const occupation = curr.occupation || "Unknown";
    if (yearData[occupation] !== undefined) {
      yearData[occupation] = (yearData[occupation] as number) + 1;
    }

    return acc;
  }, [] as { year: string; [occupation: string]: string | number; }[]);

  // Sort by year
  collectionYearOccupationDistribution.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  return {
    totalClusters,
    riskLevelSummary,
    recentClusters,
    clusterDistribution,
    lineageDistribution,
    provinceDistribution,
    districtSummary,
    collectionYearDistribution,
    collectionYearSexDistribution,
    collectionYearAgeBoxPlot,
    collectionYearEthnicGroupDistribution,
    ethnicGroups,
    collectionYearEducationDistribution,
    educationLevels,
    collectionYearOccupationDistribution,
    occupations,
  };
};

export default function DashboardPage() {
  const [rawData, setRawData] = useState<RawClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    province: "",
    collectionDateStart: "",
    collectionDateEnd: "",
    majorLineage: "",
    overallDRGenotype: "",
    lineage: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/txt`);
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }
        const json: unknown = await response.json();
        const rows = coerceRawClusterRows(json);
        if (rows.length === 0) {
          throw new Error("Unexpected data format from API");
        }
        setRawData(rows);
      } catch (error) {
        setError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const scopedForProvince = useMemo(
    () => applyFilters(rawData, filters, "province"),
    [rawData, filters]
  );
  const scopedForMajorLineage = useMemo(
    () => applyFilters(rawData, filters, "majorLineage"),
    [rawData, filters]
  );
  const scopedForLineage = useMemo(
    () => applyFilters(rawData, filters, "lineage"),
    [rawData, filters]
  );
  const scopedForOverallDRGenotype = useMemo(
    () => applyFilters(rawData, filters, "overallDRGenotype"),
    [rawData, filters]
  );

  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    scopedForProvince.forEach((r) => set.add(normalizeValue(r.province)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedForProvince]);

  const majorLineageOptions = useMemo(() => {
    const set = new Set<string>();
    scopedForMajorLineage.forEach((r) => set.add(normalizeValue(r.major_lineage)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedForMajorLineage]);

  const lineageOptions = useMemo(() => {
    const set = new Set<string>();
    scopedForLineage.forEach((r) => set.add(normalizeValue(r.lineage)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedForLineage]);

  const overallDRGenotypeOptions = useMemo(() => {
    const set = new Set<string>();
    scopedForOverallDRGenotype.forEach((r) =>
      set.add(normalizeValue(r.overall_DR_genotype))
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scopedForOverallDRGenotype]);

  const filteredRawData = useMemo(() => {
    if (!rawData.length) return rawData;
    return applyFilters(rawData, filters);
  }, [filters, rawData]);

  useEffect(() => {
    if (!rawData.length) return;

    const provinceSet = new Set(provinceOptions);
    const majorLineageSet = new Set(majorLineageOptions);
    const lineageSet = new Set(lineageOptions);
    const overallSet = new Set(overallDRGenotypeOptions);
    setFilters((prev) => {
      const next: DashboardFilters = { ...prev };
      let changed = false;

      if (next.province && !provinceSet.has(next.province)) {
        next.province = "";
        changed = true;
      }
      if (next.majorLineage && !majorLineageSet.has(next.majorLineage)) {
        next.majorLineage = "";
        changed = true;
      }
      if (next.lineage && !lineageSet.has(next.lineage)) {
        next.lineage = "";
        changed = true;
      }
      if (next.overallDRGenotype && !overallSet.has(next.overallDRGenotype)) {
        next.overallDRGenotype = "";
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    rawData.length,
    provinceOptions,
    majorLineageOptions,
    lineageOptions,
    overallDRGenotypeOptions,
  ]);

  const data: TransformedData | null = useMemo(() => {
    if (!filteredRawData.length) return null;
    return transformBackendData(filteredRawData);
  }, [filteredRawData]);

  const canReset =
    !!filters.province ||
    !!filters.collectionDateStart ||
    !!filters.collectionDateEnd ||
    !!filters.majorLineage ||
    !!filters.overallDRGenotype ||
    !!filters.lineage;


  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">MTB Cluster Dashboard</h1>
      {error && <div>Error: {error.message}</div>}
      {!error && loading && <div>Loading...</div>}
      {!error && !loading && !data && <div>No data available</div>}

      {!error && data && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <FilterDropdown
                  label="Province"
                  value={filters.province}
                  options={provinceOptions}
                  onChange={(province) =>
                    setFilters((prev) => ({ ...prev, province }))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="collection-date-start">Collection date (start)</Label>
                  <Input
                    id="collection-date-start"
                    type="date"
                    value={filters.collectionDateStart}
                    max={filters.collectionDateEnd || undefined}
                    onChange={(e) =>
                      setFilters((prev) => {
                        const nextStart = e.target.value;
                        const next: typeof prev = {
                          ...prev,
                          collectionDateStart: nextStart,
                        };
                        if (
                          next.collectionDateEnd &&
                          nextStart &&
                          nextStart > next.collectionDateEnd
                        ) {
                          next.collectionDateEnd = "";
                        }
                        return next;
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="collection-date-end">Collection date (end)</Label>
                  <Input
                    id="collection-date-end"
                    type="date"
                    value={filters.collectionDateEnd}
                    min={filters.collectionDateStart || undefined}
                    disabled={!filters.collectionDateStart}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        collectionDateEnd: e.target.value,
                      }))
                    }
                  />
                </div>
                <FilterDropdown
                  label="Major lineage"
                  value={filters.majorLineage}
                  options={majorLineageOptions}
                  onChange={(majorLineage) =>
                    setFilters((prev) => ({ ...prev, majorLineage }))
                  }
                />
                <FilterDropdown
                  label="Lineage"
                  value={filters.lineage}
                  options={lineageOptions}
                  onChange={(lineage) =>
                    setFilters((prev) => ({ ...prev, lineage }))
                  }
                />
                <FilterDropdown
                  label="Overall DR genotype"
                  value={filters.overallDRGenotype}
                  options={overallDRGenotypeOptions}
                  onChange={(overallDRGenotype) =>
                    setFilters((prev) => ({ ...prev, overallDRGenotype }))
                  }
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!canReset}
                    onClick={() =>
                      setFilters({
                        province: "",
                        collectionDateStart: "",
                        collectionDateEnd: "",
                        majorLineage: "",
                        overallDRGenotype: "",
                        lineage: "",
                      })
                    }
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {data.riskLevelSummary &&
              data.riskLevelSummary
                .filter(
                  (item) =>
                    ![
                      "Other",
                      "Sensitive",
                      "HR-TB",
                      "MDR-TB",
                      "RR-TB",
                      "Pre-XDR-TB",
                      "XDR-TB",
                    ].includes(item.title)
                )
                .map((item, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </CardContent>
                  </Card>
                ))}
          </div>



          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Lineage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.lineageDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label
                    >
                      {data.lineageDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Province Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.provinceDistribution}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Sample Collection Year</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.collectionYearDistribution}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="count" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
          
                      <Card>
                        <CardHeader>
                          <CardTitle>Sample Collection Year by Sex</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.collectionYearSexDistribution}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="maleCount" stackId="a" fill="#8884d8" name="Male" />
                              <Bar dataKey="femaleCount" stackId="a" fill="#82ca9d" name="Female" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Age Distribution by Collection Year (Box Plot)</CardTitle>
              </CardHeader>
              <CardContent>
                <BoxPlotChart data={data.collectionYearAgeBoxPlot} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ethnic Group Distribution by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.collectionYearEthnicGroupDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {data.ethnicGroups.map((group, index) => (
                      <Bar
                        key={group}
                        dataKey={group}
                        stackId="a"
                        fill={COLORS[index % COLORS.length]}
                        name={group}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Education Distribution by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.collectionYearEducationDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {data.educationLevels.map((level, index) => (
                      <Bar
                        key={level}
                        dataKey={level}
                        stackId="a"
                        fill={COLORS[index % COLORS.length]}
                        name={level}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Occupation Distribution by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.collectionYearOccupationDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {data.occupations.map((occ, index) => (
                      <Bar
                        key={occ}
                        dataKey={occ}
                        stackId="a"
                        fill={COLORS[index % COLORS.length]}
                        name={occ}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>District Summary</CardTitle>
              </CardHeader>
              <CardContent style={{ height: "500px" }}>
                <ThailandMap districtSummary={data.districtSummary} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}