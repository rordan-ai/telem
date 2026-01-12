import React from "react";
import { motion } from "framer-motion";
import { Users, ShieldCheck, Building2, Briefcase } from "lucide-react";

const positions = [
{ id: "general", label: "עובדים כללי", icon: Users },
{ id: "segan_tzoran", label: "סגן צורן", icon: ShieldCheck },
{ id: "segan_beer_yaakov", label: "סגן באר יעקב", icon: Building2 },
{ id: "manager_commerce", label: "מנהל סחר", icon: Briefcase }];


export default function PositionTabs({ activePosition, onPositionChange }) {
  return (
    <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
      {positions.map((position) => {
        const isActive = activePosition === position.id;

        return (
          <button
            key={position.id}
            onClick={() => onPositionChange(position.id)}
            className="text-slate-900 px-2 py-2 text-xs font-medium rounded-xl relative flex-1 flex items-center justify-center transition-colors duration-200 hover:text-slate-700">

            {isActive &&
            <motion.div
              layoutId="activeTab"
              className="bg-slate-400 rounded-xl absolute inset-0 shadow-sm"
              transition={{ type: "spring", duration: 0.4 }} />
            }
            <span className="relative whitespace-nowrap">
              {position.label}
            </span>
          </button>);

      })}
    </div>);

}