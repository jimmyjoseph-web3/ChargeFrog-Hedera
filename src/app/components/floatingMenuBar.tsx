"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Define the menu items (supporting multiple routes per item)
const menuItems = [
  { name: "map", routes: ["/map", "/station/[stationId]", "/charging"] },
  { name: "bolt", routes: ["/credit", "/swap"] },
  { name: "hammer", routes: ["/proposal", "/proposal/[stationId]", "/invest/[stationId]"] },
  { name: "piggy", routes: ["/claim"] },
  { name: "smile", routes: ["/profile"] },
];

// Component for a single menu item
const FloatingMenuBarItem = ({ name, routes }: (typeof menuItems)[0]) => {
  const currentPath = usePathname();
  
  const isActive = routes.some((route) => {
    if (route.includes("[") && route.includes("]")) {
      const baseRoute = route.split("/[")[0]; // e.g., "/station"
      return currentPath.startsWith(baseRoute + "/");
    }
    return route === currentPath;
  });

  const iconName = isActive ? `${name}-active.png` : `${name}.png`;
  const iconPath = `/floatingMenuBar/${iconName}`;

  const activeBoxStyle = isActive
    ? "bg-[#F2F2F2] rounded-xl shadow-sm"
    : "hover:bg-gray-50 rounded-xl mx-3";

  return (
    <Link href={routes[0]} className="flex-1">
      <div
        className={`
          relative flex flex-col items-center justify-center 
          py-4 mx-1 cursor-pointer 
          transition-colors duration-200 
          ${activeBoxStyle}
        `}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-full">
          <img
            src={iconPath}
            alt={name}
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain transition-transform duration-200 hover:scale-110"
          />
        </div>

        {/* Active indicator bar */}
        {isActive && (
          <div
            className="absolute bottom-0 left-4 right-4 h-2 bg-[#0D0] opacity-90 transition-all duration-300"
            style={{ borderRadius: "30px 30px 0 0" }}
          />
        )}
      </div>
    </Link>
  );
};

// The main Floating Menu Bar component
const FloatingMenuBar = () => {
  const heightStyle = "h-[15vh] min-h-[70px] max-h-[90px]";

  return (
    <div
      className={`
        fixed inset-x-0 bottom-4 sm:bottom-6 z-[1000] 
        flex justify-center px-3
      `}
    >
      {/* Actual menu bar */}
      <div
        className={`
          w-full max-w-xl ${heightStyle}
          bg-white shadow-lg
          rounded-4xl border border-gray-200
          flex items-center justify-around px-2
        `}
      >
        {menuItems.map((item) => (
          <FloatingMenuBarItem key={item.name} {...item} />
        ))}
      </div>
    </div>
  );
};

export default FloatingMenuBar;
