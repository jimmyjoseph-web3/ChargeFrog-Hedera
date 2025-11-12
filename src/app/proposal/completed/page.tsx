import CompletedProposalCardList from "@/src/components/proposal/completedProposalCardList";
import FloatingMenuBar from "@/src/components/floatingMenuBar";
import FloatingMenuBarBgCover from "@/src/components/floatingMenuBarBgCover";

export default function CompletedProposal() {

  return (
    <>
      <FloatingMenuBar />
      <FloatingMenuBarBgCover />

      <div className="flex flex-col items-center bg-white min-h-screen px-4 pt-4 mb-40 relative">
        <div className="w-full space-y-3">
          <CompletedProposalCardList />
        </div>
      </div>
    </>
  );
}
