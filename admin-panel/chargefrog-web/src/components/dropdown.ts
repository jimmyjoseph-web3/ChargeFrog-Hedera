import { useState } from 'react';

/**
 * Custom hook to manage dropdown sections.
 * @returns An object containing the current open section and a function to toggle sections.
 */
export function useDropdownSection() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return { openSection, toggleSection };
}

/**
 * Custom hook to manage dropdown rows.
 * @returns An object containing the expanded rows state and a function to toggle rows.
 */
export function useDropdownRow(
  setBalance: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const newExpandedRows = Object.keys(prev).reduce(
        (acc, key) => {
          acc[Number(key)] = false; // Collapse all rows
          return acc;
        },
        {} as Record<number, boolean>,
      );

      setBalance(null); // Clear the balance when toggling rows

      return { ...newExpandedRows, [id]: !prev[id] }; // Toggle the clicked row
    });
  };

  return { expandedRows, toggleRow };
}