import React from "react";
import { motion } from "framer-motion";
import { Users, ShieldCheck, Building2, Briefcase } from "lucide-react";

const positions = [
{ id: "general", label: "עובדים כללי", icon: Users },
{ id: "segan_tzoran", label: "סגן צורן", icon: ShieldCheck },
{ id: "segan_beer_yaakov", label: "סגן באר יעקב", icon: Building2 },
{ id: "manager_commerce", label: "מנהל סחר", icon: Briefcase },
{ id: "climbing_wall", label: "קיר טיפוס", icon: Users }];


export default function PositionTabs({ activePosition, onPositionChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-slate-800 rounded-2xl p-1 gap-1">
      {positions.map((position) => {
        const isActive = activePosition === position.id;

        return (
          <button
            key={position.id}
            onClick={() => onPositionChange(position.id)}
            className="text-slate-300 px-3 py-2 text-xs font-medium rounded-xl relative flex items-center justify-center transition-colors duration-200 hover:text-slate-100 text-center">

            {isActive &&
            <motion.div
              layoutId="activeTab"
              className="bg-blue-600 rounded-xl absolute inset-0 shadow-md"
              transition={{ type: "spring", duration: 0.4 }} />
            }
            <span className="relative">
              {position.label}
            </span>
          </button>);

      })}
    </div>);

}