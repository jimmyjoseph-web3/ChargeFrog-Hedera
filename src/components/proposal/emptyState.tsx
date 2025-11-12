import FloatingMenuBar from "../floatingMenuBar";
import FloatingMenuBarBgCover from "../floatingMenuBarBgCover";

export default function EmptyState() {
  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <img
          src="/proposal/empty.png"
          alt="Empty proposals"
          className="w-60 h-auto mb-4"
        />
        <p className="text-gray-400 font-medium text-center mb-8">
          No related proposals found by Froggy...
        </p>
      </div>
    </>
  );
}
