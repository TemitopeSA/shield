"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "#9a9892" };

export function EvaluationsChart({ data }: { data: { month: string; passed: number; rejected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gPass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#121211" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#121211" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eeede9" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e6e5e1", fontSize: 12, boxShadow: "0 8px 24px -8px rgba(0,0,0,.15)" }} />
        <Area type="monotone" dataKey="passed" name="Passed" stroke="#121211" strokeWidth={1.8} fill="url(#gPass)" />
        <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#c0352b" strokeWidth={1.8} fill="#c0352b" fillOpacity={0.08} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RejectionsChart({ data }: { data: { label: string; code: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={150} tick={{ ...axis, fill: "#3d3c39", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f2f2ef" }} contentStyle={{ borderRadius: 10, border: "1px solid #e6e5e1", fontSize: 12 }} formatter={(v) => [v, "Rejections"]} />
        <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={16} label={{ position: "right", fontSize: 11, fill: "#6d6c67" }}>
          {data.map((d, i) => (
            <Cell key={d.code} fill={i === 0 ? "#c0352b" : "#dc8a82"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
