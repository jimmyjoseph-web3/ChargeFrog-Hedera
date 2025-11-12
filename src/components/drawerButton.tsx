// components/DrawerButton.tsx
type DrawerButtonProps = {
  text: string;
  onClick?: () => void;
};

export default function DrawerButton({ text, onClick }: DrawerButtonProps) {
  return (
    <div className="mb-5">
    <button
      onClick={onClick}
      className="
        w-full
        bg-black text-white font-medium text-lg rounded-2xl py-4 px-6
        hover:bg-gray-900 transition-colors
        shadow-md
      "
    >
      {text}
    </button>
    </div>
  );
}
