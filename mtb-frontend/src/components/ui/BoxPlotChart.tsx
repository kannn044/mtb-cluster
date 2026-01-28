// src/components/ui/BoxPlotChart.tsx
import React from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Rectangle,
} from 'recharts';

interface BoxPlotData {
  year: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

interface BoxPlotChartProps {
  data: BoxPlotData[];
  width?: string | number;
  height?: string | number;
}

type CustomBoxPlotProps = {
  x?: number;
  y?: number;
  width?: number;
  fill?: string;
  q1?: number;
  q3?: number;
  median?: number;
  min?: number;
  max?: number;
};

const CustomBoxPlot: React.FC<CustomBoxPlotProps> = (props) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    fill = '#8884d8',
    q1 = 0,
    q3 = 0,
    median = 0,
    min = 0,
    max = 0,
  } = props;

  // Calculate the x-coordinates for the box and whiskers
  const boxWidth = width * 0.6; // Make box a bit narrower than the full bar width
  const xOffset = (width - boxWidth) / 2;
  const xBox = x + xOffset;

  return (
    <g>
      {/* Whiskers */}
      <line x1={xBox + boxWidth / 2} y1={y + (q3 - max)} x2={xBox + boxWidth / 2} y2={y + (q3 - min)} stroke={fill} strokeWidth={1} />
      <line x1={xBox + boxWidth * 0.25} y1={y + (q3 - min)} x2={xBox + boxWidth * 0.75} y2={y + (q3 - min)} stroke={fill} strokeWidth={1} />
      <line x1={xBox + boxWidth * 0.25} y1={y + (q3 - max)} x2={xBox + boxWidth * 0.75} y2={y + (q3 - max)} stroke={fill} strokeWidth={1} />

      {/* Box */}
      <Rectangle
        x={xBox}
        y={y + (q3 - q3)} // y-coordinate for the top of the box (q3)
        width={boxWidth}
        height={Math.max(1, q3 - q1)} // Height of the box from q1 to q3
        stroke={fill}
        fill={fill}
        fillOpacity={0.6}
      />

      {/* Median Line */}
      <line x1={xBox} y1={y + (q3 - median)} x2={xBox + boxWidth} y2={y + (q3 - median)} stroke={fill} strokeWidth={2} />
    </g>
  );
};


const BoxPlotChart: React.FC<BoxPlotChartProps> = ({ data, width = '100%', height = 300 }) => {
  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart data={data} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="q3" fill="#8884d8" shape={<CustomBoxPlot />} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BoxPlotChart;
