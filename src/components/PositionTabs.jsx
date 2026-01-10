import React from "react";
import { motion } from "framer-motion";
import { Coffee, ChefHat } from "lucide-react";

const positions = [
  { id: "barista", label: "בריסטה", icon: Coffee },
  { id: "cook", label: "טבח", icon: ChefHat },
];

export default function PositionTabs({ activePosition, onPositionChange }) {
  return (
    <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1">
      {positions.map((position) => {
        const Icon = position.icon;
        const isActive = activePosition === position.id;
        
        return (
          <button
            key={position.id}
            onClick={() => onPositionChange(position.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-colors duration-200 ${
              isActive ? "text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {position.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}