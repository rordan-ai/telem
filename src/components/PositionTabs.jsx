import React from "react";
import { motion } from "framer-motion";
import { Coffee, ChefHat } from "lucide-react";

const positions = [
{ id: "barista", label: "בריסטה", icon: Coffee },
{ id: "cook", label: "טבח", icon: ChefHat }];


export default function PositionTabs({ activePosition, onPositionChange }) {
  return (
    <div className="flex bg-slate-100 rounded-2xl p-1.5 gap-1">
      {positions.map((position) => {
        const Icon = position.icon;
        const isActive = activePosition === position.id;

        return (
          <button
            key={position.id}
            onClick={() => onPositionChange(position.id)} className="text-slate-900 px-4 py-3 text-sm font-medium rounded-xl relative flex-1 flex items-center justify-center gap-2 transition-colors duration-200 hover:text-slate-700">




            {isActive &&
            <motion.div
              layoutId="activeTab" className="bg-yellow-600 rounded-xl absolute inset-0 shadow-sm"

              transition={{ type: "spring", duration: 0.4 }} />

            }
            <span className="relative flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {position.label}
            </span>
          </button>);

      })}
    </div>);

}