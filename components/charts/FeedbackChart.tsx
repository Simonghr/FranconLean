"use client"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts"
import type { CustomerFeedback } from "@/lib/types"

interface FeedbackChartProps {
  feedback: CustomerFeedback[]
  title?: string
}

const sentimentConfig = {
  positive: { label: "Positif", color: "#22c55e" },
  neutral: { label: "Neutre", color: "#94a3b8" },
  negative: { label: "Négatif", color: "#ef4444" },
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
        <div className="font-medium text-white">{payload[0]?.name}</div>
        <div className="text-slate-300 mt-1">{payload[0]?.value} retours</div>
      </div>
    )
  }
  return null
}

export function FeedbackChart({ feedback, title = "Sentiment clients" }: FeedbackChartProps) {
  const counts = { positive: 0, neutral: 0, negative: 0 }
  feedback.forEach(f => { counts[f.sentiment]++ })

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: sentimentConfig[key as keyof typeof sentimentConfig].label,
      value,
      color: sentimentConfig[key as keyof typeof sentimentConfig].color,
    }))

  const total = feedback.length
  const positiveRate = total > 0 ? Math.round((counts.positive / total) * 100) : 0

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="text-sm text-green-400 font-medium">{positiveRate}% positif</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
