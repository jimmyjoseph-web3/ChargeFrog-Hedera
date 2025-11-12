// components/PageButton.tsx
type PageButtonProps = {
  text: string;
  onClick?: () => void;
};

export default function StickyPageButton({ text, onClick }: PageButtonProps) {
  return (
    <div
      className="
    fixed inset-x-0 
    bottom-[calc(15vh+0.9rem)]
    z-[900] flex justify-center px-4
  "
    >
      <button
        onClick={onClick}
        className="
          w-full max-w-md
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
